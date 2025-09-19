import api from "../services/api";

let numbersHistorial = {}

export async function getContactByNumber(number) {

  let cleanNumber = number.replace(/\D/g, "");

  if (Object.keys(numbersHistorial).includes(cleanNumber)) {
    return numbersHistorial[cleanNumber];
  }

  if (cleanNumber.length < 8) {
    return null;
  }

  let contact = null;

  const response = await api.get(
    `/contacts/getByNumber/${cleanNumber}`
  );

  if (response.data) {
    contact = response.data;
  }
  
  numbersHistorial[cleanNumber] = contact;

}