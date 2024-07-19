import axios from "axios";

const microserviceApi = axios.create({
  baseURL: "https://microservices.restaurant.pe/",
  withCredentials: true,
});

export default microserviceApi;
