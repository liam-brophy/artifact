import { useState, useEffect } from 'react';

export function useAuth() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Simulate an async call to fetch user data
        setTimeout(() => {
            // Mock user data; replace with actual API call or auth logic
            setUser({ id: 1, name: 'John Doe', role: 'artist' }); // Change role to test access control
            setIsLoading(false);
        }, 1000);
    }, []);

    return { user, isLoading };
}
