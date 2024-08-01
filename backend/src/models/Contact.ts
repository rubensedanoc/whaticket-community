import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
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

  isExclusive: boolean;

  // Sobrescribir el método toJSON para incluir isExclusive
  toJSON() {
    const attributes = { ...this.get() };
    // @ts-ignore
    attributes.isExclusive = this.isExclusive;
    return attributes;
  }
}

export default Contact;
