import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { getWbot } from "../../libs/wbot";

const GetProfilePicUrl = async (number: string): Promise<string | undefined> => {
  try {
    const defaultWhatsapp = await GetDefaultWhatsApp();

    const wbot = getWbot(defaultWhatsapp.id);

    const profilePicUrl = await wbot.getProfilePicUrl(`${number}@c.us`);

    return profilePicUrl;
  } catch (err) {
    console.log(`Error getting profile pic for number ${number}:`, err);
    return undefined;
  }
};

export default GetProfilePicUrl;
