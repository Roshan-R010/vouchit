/** Keep infrastructure/HTML errors out of customer-facing JSON parse messages. */
export async function readApiResponse(response: Response) {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("The API server is unavailable. Restart the app with npm run dev and try again.");
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}
