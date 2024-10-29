import { useContext, useEffect } from "react";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/Auth/AuthContext";
import openSocket from "../../services/socket-io";

function NotificationManager() {
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const socket = openSocket(user.id);

    const baseConfig = {
      closeOnClick: true,
      position: "bottom-right",
      closeButton: false,
    };

    // startSyncUnreadMessages

    socket.on("startSyncUnreadMessages", (data) => {
      toast.info(
        `Sincronizando mensajes del wpp de ${data.connectionName}`,
        baseConfig
      );
    });

    socket.on("endSyncUnreadMessages", (data) => {
      toast.success(
        `Se sincronizaron con exito (${data.messagesCount}) mensajes del wpp de ${data.connectionName}`,
        baseConfig
      );
    });

    // socket.on("startSearchForUnSaveMessages", (data) => {
    //   toast.info(
    //     `Buscando mensajes no guardados de ${data.connectionName}`,
    //     baseConfig
    //   );
    // });

    socket.on("endSearchForUnSaveMessages", (data) => {
      if (data.messagesCount) {
        toast.success(
          `Se sincronizaron con exito (${data.messagesCount}) mensajes del wpp de ${data.connectionName}`,
          baseConfig
        );
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  return null;
}

export default NotificationManager;
