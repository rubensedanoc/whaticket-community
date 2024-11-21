import React from "react";

import { Checkbox, ListItemText } from "@material-ui/core";
import Badge from "@material-ui/core/Badge";
import FormControl from "@material-ui/core/FormControl";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";

const ReportsCountrySelect = ({
  countries,
  selectedCountryIds = [],
  onChange,
}) => {
  const handleChange = (e) => {
    localStorage.setItem(
      "ReportsCountrySelect",
      JSON.stringify(e.target.value)
    );
    onChange(e.target.value);
  };

  return (
    <Badge
      overlap="rectangular"
      badgeContent={selectedCountryIds.length}
      color="primary"
      max={99999}
      invisible={selectedCountryIds.length === 0}
    >
      <div style={{ width: 175 }}>
        <FormControl fullWidth margin="dense">
          <Select
            multiple
            displayEmpty
            variant="outlined"
            value={selectedCountryIds}
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
            renderValue={() => "Pais del contacto"}
          >
            {countries?.length > 0 &&
              countries.map((c) => (
                <MenuItem dense key={c.id} value={c.id}>
                  <Checkbox
                    style={{
                      color: "black",
                    }}
                    size="small"
                    color="primary"
                    checked={selectedCountryIds.indexOf(c.id) > -1}
                  />
                  <ListItemText primary={c.name} />
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </div>
    </Badge>
  );
};

export default ReportsCountrySelect;
