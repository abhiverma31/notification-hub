export function checkResponse(r, expectedStatus) {
  const success = r.status === expectedStatus;

  if (!success) {
    console.log(`API call failed: Status ${r.status}`);
  }

  return success;
}
