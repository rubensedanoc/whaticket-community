import cron from "node-cron";

const MAX_NOTIFICATIONS = 5;
let notificationCounters = {};

// Tarea programada para reiniciar el contador a las 12:00 AM todos los días
cron.schedule("0 0 * * *", () => {
  notificationCounters = {};
});

const NotifyViaWppService = async ({ numberToNotify, messageToSend }) => {
  if (!notificationCounters[numberToNotify]) {
    notificationCounters[numberToNotify] = 0;
  }

  if (notificationCounters[numberToNotify] >= MAX_NOTIFICATIONS) {
    return;
  }

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
          messageToSend +
          " - intento: " +
          notificationCounters[numberToNotify] +
          1,
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
        notificationCounters[numberToNotify] += 1;
      } else {
        throw "Error en NotifyViaWppService: " + data.data?.message;
      }
    })
    .catch(err => {
      console.log("Error en NotifyViaWppService", err);
    });
};

export default NotifyViaWppService;
