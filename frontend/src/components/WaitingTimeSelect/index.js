import React from "react";
import { Chip, FormControl, MenuItem, Select, Checkbox, ListItemText, InputLabel } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  chips: {
    display: "flex",
    flexWrap: "wrap",
  },
  chip: {
    margin: 2,
    height: 20,
    fontSize: 11,
  },
}));

const RANGES = [
  { id: "0-30", label: "0-30 min", color: "#4caf50", icon: "🟢" },
  { id: "30-60", label: "30-60 min", color: "#ffeb3b", icon: "🟡" },
  { id: "60-120", label: "1-2h", color: "#ff9800", icon: "🟠" },
  { id: "120-240", label: "2-4h", color: "#ff5722", icon: "🟠" },
  { id: "240-480", label: "4-8h", color: "#f44336", icon: "🔴" },
  { id: "480-960", label: "8-16h", color: "#d32f2f", icon: "🔴" },
  { id: "960-1440", label: "16h-1d (OK)", color: "#2196f3", icon: "🔵" },
  { id: "1440-2880", label: "1-2d (Regular)", color: "#ff9800", icon: "🟠" },
  { id: "2880-4320", label: "2-3d (Malo)", color: "#ff5722", icon: "🔴" },
  { id: "4320+", label: "+3d (Pésimo)", color: "#000000", icon: "⚫" },
];

const WaitingTimeSelect = ({ selectedRanges = [], onChange, style }) => {
  const classes = useStyles();

  const handleChange = (event) => {
    const value = event.target.value;
    if (value.includes("all")) {
      onChange([]);
      return;
    }
    onChange(value);
  };

  const hasSelection = selectedRanges.length > 0;

  return (
    <FormControl variant="outlined" style={{ minWidth: 120, ...style }}>
      <InputLabel id="time-select-label">Tiempo</InputLabel>
      <Select
        labelId="time-select-label"
        multiple
        value={selectedRanges}
        onChange={handleChange}
        label="Tiempo"
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight: 400,
            },
          },
          anchorOrigin: {
            vertical: "bottom",
            horizontal: "left"
          },
          transformOrigin: {
            vertical: "top",
            horizontal: "left"
          },
          getContentAnchorEl: null
        }}
        renderValue={(selected) => {
          if (selected.length === 0) return <em>Todos</em>;
          return (
            <div className={classes.chips}>
              {selected.map((id) => {
                const r = RANGES.find((range) => range.id === id);
                return (
                  <Chip
                    key={id}
                    label={r?.icon}
                    className={classes.chip}
                    size="small"
                    style={{
                      backgroundColor: r?.color,
                      color: ["#d32f2f", "#f44336", "#ff5722", "#2196f3", "#000000"].includes(r?.color) ? "#fff" : "#000",
                    }}
                  />
                );
              })}
            </div>
          );
        }}
      >
        <MenuItem value="all">
          <Checkbox checked={!hasSelection} />
          <ListItemText primary="Todos" />
        </MenuItem>
        {RANGES.map((r) => (
          <MenuItem key={r.id} value={r.id}>
            <Checkbox checked={selectedRanges.indexOf(r.id) > -1} />
            <ListItemText primary={`${r.icon} ${r.label}`} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default WaitingTimeSelect;
