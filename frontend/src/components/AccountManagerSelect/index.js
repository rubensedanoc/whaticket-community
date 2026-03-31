import React from "react";
import { FormControl, InputLabel, MenuItem, Select } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
  formControl: {
    minWidth: 200,
  },
}));

const AccountManagerSelect = ({ 
  selectedAccountManagerId, 
  onChange, 
  users = [],
  disabled = false 
}) => {
  const classes = useStyles();

  return (
    <FormControl 
      variant="outlined" 
      className={classes.formControl}
      margin="dense"
      disabled={disabled}
    >
      <InputLabel>Ejecutivo de Cuenta</InputLabel>
      <Select
        value={selectedAccountManagerId || ""}
        onChange={(e) => onChange(e.target.value || null)}
        label="Ejecutivo de Cuenta"
      >
        <MenuItem value="">
          <em>Sin asignar</em>
        </MenuItem>
        {users.map((user) => (
          <MenuItem key={user.id} value={user.id}>
            {user.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default AccountManagerSelect;
