import { Checkbox, ListItemText, TextField, Box } from "@material-ui/core";
import Badge from "@material-ui/core/Badge";
import Chip from "@material-ui/core/Chip";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";
import { makeStyles } from "@material-ui/core/styles";
import React, { useEffect, useState, useMemo } from "react";
import toastError from "../../errors/toastError";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  chips: {
    display: "flex",
    flexWrap: "wrap",
  },
  chip: {
    margin: 2,
  },
}));

const UsersSelect = ({ selectedIds, onChange, onLoadData, chips = true, badgeColor }) => {
  const classes = useStyles();
  const [users, setUsers] = useState([]);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/users/", {
          params: { withPagination: false, includeQueues: true },
        });
        setUsers(data.users);
        if (onLoadData) {
          onLoadData(data.users);
        }
      } catch (err) {
        toastError(err);
      }
    })();
  }, []);

  const handleChange = (e) => {
    onChange(e.target.value);
  };

  const filteredUsers = useMemo(() => {
    if (!searchText) return users;
    
    const search = searchText.toLowerCase();
    const filtered = users.filter(user => {
      const userName = user.name.toLowerCase();
      const firstQueue = user.queues && user.queues.length > 0 ? user.queues[0] : null;
      const queueName = firstQueue ? firstQueue.name.toLowerCase() : "";
      
      return userName.includes(search) || queueName.includes(search);
    });
    
    return filtered;
  }, [users, searchText]);

  return (
    <Badge
      overlap="rectangular"
      badgeContent={selectedIds.length}
      color={badgeColor || "primary"}
      max={99999}
      invisible={selectedIds.length === 0 || chips}
    >
      <div style={chips ? { marginTop: 6 } : { width: 120 }}>
        <FormControl fullWidth margin="dense" variant="outlined">
          {chips && <InputLabel>Usuarios</InputLabel>}
          <Select
            multiple
            label={chips ? "Usuarios" : undefined}
            displayEmpty={!chips}
            value={selectedIds}
            onChange={handleChange}
            MenuProps={{
              anchorOrigin: {
                vertical: "bottom",
                horizontal: "left",
              },
              transformOrigin: {
                vertical: "top",
                horizontal: "left",
              },
              getContentAnchorEl: null,
              autoFocus: false,
              PaperProps: {
                style: {
                  maxHeight: 320,
                },
              },
            }}
            onClose={() => setSearchText("")}
            renderValue={(selected) =>
              chips ? (
                <div className={classes.chips}>
                  {selected?.length > 0 &&
                    selected.map((id) => {
                      const user = users.find((q) => q.id === id);
                      return user ? (
                        <Chip
                          key={id}
                          style={{ backgroundColor: user.color }}
                          variant="outlined"
                          label={user.name}
                          className={classes.chip}
                        />
                      ) : null;
                    })}
                </div>
              ) : (
                "Usuarios"
              )
            }
          >
            <Box px={2} pt={1} pb={1} style={{ position: "sticky", top: 0, backgroundColor: "white", zIndex: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar usuario o departamento..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                variant="outlined"
              />
            </Box>
            {filteredUsers.map((user) => {
              const firstQueue = user.queues && user.queues.length > 0 ? user.queues[0] : null;
              const queueAbbr = firstQueue ? firstQueue.name.substring(0, 4).toUpperCase() : null;
              const displayName = queueAbbr ? `${user.name} (${queueAbbr})` : user.name;
              
              return (
                <MenuItem key={user.id} value={user.id}>
                  {chips ? (
                    displayName
                  ) : (
                    <>
                      <Checkbox
                        style={{
                          color: user.color || "black",
                        }}
                        size="small"
                        color="primary"
                        checked={selectedIds.indexOf(user.id) > -1}
                      />
                      <ListItemText primary={displayName} />
                    </>
                  )}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </div>
    </Badge>
  );
};

export default UsersSelect;
