import React, { createContext, useEffect, useState } from 'react';
import { toast } from "react-toastify";
import openSocket from "../services/socket-io";

// 1. Crear el Contexto
const ReloadDataBecauseSocketContext = createContext();

// 2. Crear un Provider del Contexto
const ReloadDataBecauseSocketContextProvider = ({ children }) => {
  const [_, setWasDisConnected] = useState('connecting');
  const [reconnect, setReconnect] = useState(0);

  useEffect(() => {
    const socket = openSocket();

    socket.on("connect", (data) => {
      // Las reconexiones de mantenimiento (limpieza de rooms) llegan con el
      // marcador __maintenance: no muestran avisos, pero SÍ recargan la data
      // porque durante la reconexión pudieron perderse eventos del socket.
      const isMaintenance = Boolean(data && data.__maintenance);
      console.log("-------------------------connect-------------------------");

      setWasDisConnected((prevState) => {
        if (prevState === 'disconnected') {
          if (!isMaintenance) {
            toast.success("Conexión al servidor restablecida");
          }
          setReconnect((prevState) => prevState + 1);
        }
        return 'connected';
      });
    });

    socket.on("disconnect", (reason) => {
      const isMaintenance = Boolean(reason && reason.__maintenance);
      console.log(
        ".........................disconnect........................."
      );
      setWasDisConnected((prevState) => {
        if (prevState === 'connected') {
          if (!isMaintenance) {
            toast.error("Te desconectaste del servidor, dale F5");
          }
          return 'disconnected'
        }
        return prevState;
      });
    });

    return () => {
      setWasDisConnected('connecting');
      socket.disconnect();
    };
  }, []);

  return (
    <ReloadDataBecauseSocketContext.Provider value={{reconnect}}>
      {children}
    </ReloadDataBecauseSocketContext.Provider>
  );
};

export { ReloadDataBecauseSocketContextProvider, ReloadDataBecauseSocketContext };