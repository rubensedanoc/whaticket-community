import { useEffect, useState } from "react";
import { getHoursCloseTicketsAuto } from "../../config";
import toastError from "../../errors/toastError";

import api from "../../services/api";

const useNotifications = ({
  pageNumber,
  searchParam,
  status,
  selectedUsersIds
}) => {
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [count, setCount] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchTickets = async () => {
        try {
          const { data } = await api.get("/notifications", {
            params: {
              pageNumber,
              searchParam,
              status,
              selectedUsersIds
            },
          });
          setTickets(data.tickets);
          setHasMore(data.hasMore);
          setCount(data.count);
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };

      fetchTickets();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [
    pageNumber,
    searchParam,
    status,
    reload,
    selectedUsersIds
  ]);

  const triggerReload = () => {
    setReload((prev) => prev + 1);
  };

  return { tickets, loading, hasMore, count, triggerReload };
};

export default useNotifications;
