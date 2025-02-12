import AppError from "../../errors/AppError";
import LogType from "../../models/LogType";

const SearchLogTypeService = async (name: string): Promise<LogType> => {
  if (!name) {
    throw new AppError("ERR_LOG_TYPE_NAME_REQUIRED");
  }

  const logType = await LogType.findOne({
    where: {
      name
    }
  });

  if (!logType) {
    throw new AppError(`ERR_LOG_TYPE_NOT_FOUND ${name}`);
  }

  return logType;
};

export default SearchLogTypeService;
