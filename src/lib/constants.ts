import type { Category } from "@/lib/types";
import { User, Palette, Apple, Dog, Car, MapPin, Package, Mailbox, Briefcase } from "lucide-react";

export const CATEGORIES: Category[] = [
  { id: "nome", name: "Nome", icon: User },
  { id: "cor", name: "Cor", icon: Palette },
  { id: "fruta", name: "Fruta", icon: Apple },
  { id: "animal", name: "Animal", icon: Dog },
  { id: "carro", name: "Carro", icon: Car },
  { id: "lugar", name: "Lugar", icon: MapPin },
  { id: "objeto", name: "Objeto", icon: Package },
  { id: "cep", name: "CEP", icon: Mailbox },
  { id: "profissao", name: "Profissão", icon: Briefcase }, // 👈 Nova categoria
];
