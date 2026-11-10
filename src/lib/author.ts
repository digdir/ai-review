/** SHA-256 of the lowercased login in hex, the same as `authorHash` in dashboard/pulls.mjs. */
export async function hashLogin(login: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(login.trim().toLowerCase()));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
