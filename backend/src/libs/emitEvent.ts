export function emitEvent({
  to,
  event
}: {
  to?: any[];
  event: { name: string; data: any };
}) {
  const url = process.env.NODE_URL + "/toEmit";
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to,
      event
    })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error("Network response was not ok " + response.statusText);
      }
      return response.json();
    })
    .then(data => {
      // console.log("Success:", data);
    })
    .catch(error => {
      console.error("EmitEvent Error:", error);
    });
}
