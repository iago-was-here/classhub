function createAuthClient({ url, timeoutMs = 3000 }) {
    return {
        async validateToken(token) {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
                signal: AbortSignal.timeout(timeoutMs)
            });

            if (response.status === 401) return null;
            if (!response.ok) throw new Error(`Auth Service respondeu ${response.status}`);

            const data = await response.json();
            if (!data.valid || typeof data.user_id !== 'string') return null;

            return { id: data.user_id };
        }
    };
}

module.exports = { createAuthClient };