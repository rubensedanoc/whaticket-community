import React from "react";

import { Checkbox, ListItemText } from "@material-ui/core";
import Badge from "@material-ui/core/Badge";
import FormControl from "@material-ui/core/FormControl";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";

const ReportsTicketTypeSelect = ({ types, selectedTypes = [], onChange }) => {
  const handleChange = (e) => {
    localStorage.setItem(
      "ReportsTicketTypeSelect",
      JSON.stringify(e.target.value)
    );
    onChange(e.target.value);
  };

  return (
    <Badge
      badgeContent={selectedTypes.length}
      color="primary"
      max={99999}
      invisible={selectedTypes.length === 0}
    >
      <div style={{ width: 140 }}>
        <FormControl fullWidth margin="dense">
          <Select
            multiple
            displayEmpty
            variant="outlined"
            value={selectedTypes}
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
            }}
            renderValue={() => "Tipos"}
          >
            {types?.length > 0 &&
              types.map((t) => (
                <MenuItem dense key={t.id} value={t.id}>
                  <Checkbox
                    style={{
                      color: "black",
                    }}
                    size="small"
                    color="primary"
                    checked={selectedTypes.indexOf(t.id) > -1}
                  />
                  <ListItemText primary={t.name} />
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </div>
    </Badge>
  );
};

export default ReportsTicketTypeSelect;
