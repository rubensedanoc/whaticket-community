import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Contact from "./Contact";

@Table({ tableName: "ContactEtapaHistory" })
class ContactEtapaHistory extends Model<ContactEtapaHistory> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @Column
  etapaId: number; // ID de la etapa (5 = ALTA)

  @Column
  previousEtapaId: number; // Etapa anterior

  @CreatedAt
  createdAt: Date; // Fecha del cambio

  @UpdatedAt
  updatedAt: Date;
}

export default ContactEtapaHistory;
