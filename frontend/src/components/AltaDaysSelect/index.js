import React from "react";

import Badge from "@material-ui/core/Badge";
import FormControl from "@material-ui/core/FormControl";
import MenuItem from "@material-ui/core/MenuItem";
import Select from "@material-ui/core/Select";

const AltaDaysSelect = ({ value = "", onChange }) => {
  const handleChange = (event) => {
    const nextValue = event.target.value;
    localStorage.setItem("selectedAltaDaysFilter", JSON.stringify(nextValue));
    onChange(nextValue);
  };

  return (
    <Badge
      overlap="rectangular"
      badgeContent={1}
      color="secondary"
      invisible={!value}
    >
      <FormControl>
        <Select
          displayEmpty
          variant="outlined"
          value={value}
          onChange={handleChange}
          renderValue={(selected) => {
            if (selected === "alta-15-or-less") return "Alta ≤ 15 días";
            if (selected === "alta-15-or-more") return "Alta > 15 días";
            return "Alta por días";
          }}
        >
          <MenuItem value="">Sin filtro</MenuItem>
          <MenuItem value="alta-15-or-less">Alta ≤ 15 días</MenuItem>
          <MenuItem value="alta-15-or-more">Alta &gt; 15 días</MenuItem>
        </Select>
      </FormControl>
    </Badge>
  );
};

export default AltaDaysSelect;
