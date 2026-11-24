import {
  Banknote,
  Building2,
  Image,
  Lock,
  Mail,
  Percent,
  Phone,
  Tag,
  TextAlignStart,
  User,
} from "lucide-react"

export const fieldIcons = {
  company: Building2,
  currency: Banknote,
  department: Tag,
  description: TextAlignStart,
  email: Mail,
  logo: Image,
  password: Lock,
  percent: Percent,
  person: User,
  phone: Phone,
} as const

export type FieldIconName = keyof typeof fieldIcons
