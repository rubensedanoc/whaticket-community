import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt
} from "sequelize-typescript";
import ContactCustomField from "./ContactCustomField";
import Country from "./Country";
import Ticket from "./Ticket";
import ContactClientelicencia from "./ContactClientelicencias";

@Table
class Contact extends Model<Contact> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column
  name: string;

  @AllowNull(false)
  @Unique
  @Column
  number: string;

  @AllowNull(false)
  @Default("")
  @Column
  email: string;

  @Column
  profilePicUrl: string;

  @Column
  domain: string;

  @Default(false)
  @Column
  isGroup: boolean;

  @AllowNull
  @Column
  isCompanyMember: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => Country)
  @Column
  countryId: number;

  @BelongsTo(() => Country)
  country: Country;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @HasMany(() => ContactCustomField)
  extraInfo: ContactCustomField[];

  @HasMany(() => ContactClientelicencia)
  contactClientelicencias: ContactClientelicencia[];

  @Column
  isExclusive: boolean;

  @Column
  traza_clientelicencia_id: number;

  @Column
  traza_clientelicencia_currentetapaid: number;

  @Column(DataType.ENUM("HIGH_TOUCH", "LOW_TOUCH", "TECH_TOUCH"))
  attentionType: string;
}

export default Contact;
