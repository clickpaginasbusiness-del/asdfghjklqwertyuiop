import {
  Target, Calendar, Users, Star, StarHalf, XCircle, ShieldCheck, UserPlus, RefreshCw,
  MessageCircle, CheckCircle, Scissors, Sparkles, Image, Images, DollarSign,
  Zap, User, Palette, Heart, TrendingUp, Gift,
  type LucideIcon,
} from 'lucide-react'

const MISSAO_ICONES: Record<string, LucideIcon> = {
  Target, Calendar, Users, Star, StarHalf, XCircle, ShieldCheck, UserPlus, RefreshCw,
  MessageCircle, CheckCircle, Scissors, Sparkles, Image, Images, DollarSign,
  Zap, User, Palette, Heart, TrendingUp, Gift,
}

export function getMissaoIcone(nome: string | null | undefined): LucideIcon {
  return (nome && MISSAO_ICONES[nome]) || Target
}
