import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Clone response to read text without consuming the stream
      const clonedRes = res.clone();
      const text = await clonedRes.text();
      
      // Check if it's HTML error page
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        throw new Error(`${res.status}: Server returned HTML error page`);
      }
      
      // Handle file session expired (410 status)
      if (res.status === 410) {
        try {
          const errorData = JSON.parse(text);
          if (errorData?.action === 'reupload') {
            throw new Error(`File session expired: ${errorData.message || 'Please re-upload your file'}`);
          }
        } catch (jsonError) {
          // Fallback if JSON parse fails
          throw new Error(`File session expired: Please re-upload your file`);
        }
      }
      
      throw new Error(`${res.status}: ${text || res.statusText}`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Server returned HTML')) {
        throw error;
      }
      console.error('Error parsing response:', error);
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

export async function apiRequest(
  url: string,
  options?: RequestInit,
): Promise<any> {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...options,
    });

    await throwIfResNotOk(res);
    
    // Check if response is JSON
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        return await res.json();
      } catch (jsonError) {
        console.error('JSON parsing failed:', jsonError);
        const text = await res.text();
        console.warn('Response text:', text.substring(0, 200));
        throw new Error('Failed to parse JSON response from server');
      }
    } else {
      const text = await res.text();
      console.warn('Non-JSON response received:', text.substring(0, 200));
      
      // If we get HTML, it means Vite intercepted our API call
      // Return empty object instead of throwing to prevent app crash
      if (text.includes('<!DOCTYPE html>')) {
        console.warn('Vite intercepted API call, returning empty response');
        return {};
      }
      throw new Error('Server returned non-JSON response');
    }
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      const res = await fetch(queryKey.join("/") as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      
      // Check if response is JSON
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          return await res.json();
        } catch (jsonError) {
          console.error('Query JSON parsing failed:', jsonError);
          const text = await res.text();
          console.warn('Query response text:', text.substring(0, 200));
          throw new Error('Failed to parse JSON response from server');
        }
      } else {
        const text = await res.text();
        console.warn('Non-JSON query response:', text.substring(0, 200));
        
        // If we get HTML, it means Vite intercepted our API call
        // Return empty array/object instead of throwing to prevent app crash
        if (text.includes('<!DOCTYPE html>')) {
          console.warn('Vite intercepted query, returning empty response');
          return null;
        }
        throw new Error('Server returned non-JSON response');
      }
    } catch (error) {
      console.error('Query failed:', queryKey.join("/"), error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 3,
      retryDelay: 1000,
    },
    mutations: {
      retry: 1,
    },
  },
});
