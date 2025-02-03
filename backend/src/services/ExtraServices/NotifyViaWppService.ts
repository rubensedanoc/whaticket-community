const NotifyViaWppService = async ({ numberToNotify, messageToSend }) => {
  console.log("NotifyViaWppService", { numberToNotify, messageToSend });
  fetch(
    "http://microservices.restaurant.pe/chat/public/rest/common/sendWhatAppMessage",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        telefono: numberToNotify,
        texto:
          messageToSend,
        type: "text"
      })
    }
  )
    .then(response => {
      if (response.ok) {
        return response.json();
      }
    })
    .then(data => {
      if (data.data?.success) {
      } else {
        throw "Error en NotifyViaWppService: " + data.data?.message;
      }
    })
    .catch(err => {
      console.log("Error en NotifyViaWppService", err);
    });
};

export default NotifyViaWppService;
