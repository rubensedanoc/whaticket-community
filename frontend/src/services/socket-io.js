import openSocket from "socket.io-client";
import { getNodeUrl } from "../config";

function connectToSocket(userId) {
  const token = localStorage.getItem("token");
  const url = getNodeUrl();
  console.log(url);
  return openSocket(url, {
    transports: ["websocket"],
    query: {
      token: JSON.parse(token),
      ...(userId && { userId }),
    },
  });
}

export default connectToSocket;
