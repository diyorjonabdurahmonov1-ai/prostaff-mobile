/**
 * The app's single icon surface — Phosphor, Duotone, 24px, 1.5px stroke.
 *
 * Duotone is the house style: a stroked glyph over a low-opacity fill of the
 * same hue. Nothing is ever rendered solid-filled, so icons keep the same
 * optical weight as the type next to them.
 *
 * Icons are imported one file deep (`phosphor-react-native/src/icons/X`)
 * rather than from the package barrel. The barrel re-exports ~1500 modules and
 * Metro does not tree-shake, so importing it would pull the entire set into
 * the bundle.
 *
 * `IconName` keeps the Ionicons-style names the screens already pass around,
 * which is what lets the whole app switch iconography from this one file. Any
 * name not in the map is a type error, so nothing silently falls back.
 */

import { AlarmIcon } from 'phosphor-react-native/src/icons/Alarm';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { ArrowRightIcon } from 'phosphor-react-native/src/icons/ArrowRight';
import { ArrowsClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowsClockwise';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { BellRingingIcon } from 'phosphor-react-native/src/icons/BellRinging';
import { BriefcaseIcon } from 'phosphor-react-native/src/icons/Briefcase';
import { BroadcastIcon } from 'phosphor-react-native/src/icons/Broadcast';
import { BroomIcon } from 'phosphor-react-native/src/icons/Broom';
import { BuildingsIcon } from 'phosphor-react-native/src/icons/Buildings';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretLeftIcon } from 'phosphor-react-native/src/icons/CaretLeft';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CaretUpIcon } from 'phosphor-react-native/src/icons/CaretUp';
import { ChartLineIcon } from 'phosphor-react-native/src/icons/ChartLine';
import { ChatCircleDotsIcon } from 'phosphor-react-native/src/icons/ChatCircleDots';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { ChecksIcon } from 'phosphor-react-native/src/icons/Checks';
import { CircleIcon } from 'phosphor-react-native/src/icons/Circle';
import { ClipboardTextIcon } from 'phosphor-react-native/src/icons/ClipboardText';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { ConfettiIcon } from 'phosphor-react-native/src/icons/Confetti';
import { CloudSlashIcon } from 'phosphor-react-native/src/icons/CloudSlash';
import { CoinsIcon } from 'phosphor-react-native/src/icons/Coins';
import { CreditCardIcon } from 'phosphor-react-native/src/icons/CreditCard';
import { CrosshairIcon } from 'phosphor-react-native/src/icons/Crosshair';
import { CurrencyCircleDollarIcon } from 'phosphor-react-native/src/icons/CurrencyCircleDollar';
import { DotsThreeIcon } from 'phosphor-react-native/src/icons/DotsThree';
import { EyeIcon } from 'phosphor-react-native/src/icons/Eye';
import { EyeSlashIcon } from 'phosphor-react-native/src/icons/EyeSlash';
import { GearSixIcon } from 'phosphor-react-native/src/icons/GearSix';
import { GlobeIcon } from 'phosphor-react-native/src/icons/Globe';
import { GridFourIcon } from 'phosphor-react-native/src/icons/GridFour';
import { HammerIcon } from 'phosphor-react-native/src/icons/Hammer';
import { HardHatIcon } from 'phosphor-react-native/src/icons/HardHat';
import { HeartIcon } from 'phosphor-react-native/src/icons/Heart';
import { HourglassIcon } from 'phosphor-react-native/src/icons/Hourglass';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { LightningIcon } from 'phosphor-react-native/src/icons/Lightning';
import { ListBulletsIcon } from 'phosphor-react-native/src/icons/ListBullets';
import { ListChecksIcon } from 'phosphor-react-native/src/icons/ListChecks';
import { LockIcon } from 'phosphor-react-native/src/icons/Lock';
import { LockOpenIcon } from 'phosphor-react-native/src/icons/LockOpen';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { MedalIcon } from 'phosphor-react-native/src/icons/Medal';
import { MoneyIcon } from 'phosphor-react-native/src/icons/Money';
import { MoonIcon } from 'phosphor-react-native/src/icons/Moon';
import { PackageIcon } from 'phosphor-react-native/src/icons/Package';
import { PaperPlaneTiltIcon } from 'phosphor-react-native/src/icons/PaperPlaneTilt';
import { PencilSimpleIcon } from 'phosphor-react-native/src/icons/PencilSimple';
import { PhoneIcon } from 'phosphor-react-native/src/icons/Phone';
import { MinusIcon } from 'phosphor-react-native/src/icons/Minus';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { ProhibitIcon } from 'phosphor-react-native/src/icons/Prohibit';
import { ReceiptIcon } from 'phosphor-react-native/src/icons/Receipt';
import { SelectionAllIcon } from 'phosphor-react-native/src/icons/SelectionAll';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { SignOutIcon } from 'phosphor-react-native/src/icons/SignOut';
import { SparkleIcon } from 'phosphor-react-native/src/icons/Sparkle';
import { SprayBottleIcon } from 'phosphor-react-native/src/icons/SprayBottle';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { StorefrontIcon } from 'phosphor-react-native/src/icons/Storefront';
import { TagIcon } from 'phosphor-react-native/src/icons/Tag';
import { TreeIcon } from 'phosphor-react-native/src/icons/Tree';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { TrendDownIcon } from 'phosphor-react-native/src/icons/TrendDown';
import { TrayIcon } from 'phosphor-react-native/src/icons/Tray';
import { TrendUpIcon } from 'phosphor-react-native/src/icons/TrendUp';
import { TruckIcon } from 'phosphor-react-native/src/icons/Truck';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import { UserCircleIcon } from 'phosphor-react-native/src/icons/UserCircle';
import { UsersIcon } from 'phosphor-react-native/src/icons/Users';
import { WalletIcon } from 'phosphor-react-native/src/icons/Wallet';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { WifiHighIcon } from 'phosphor-react-native/src/icons/WifiHigh';
import { WrenchIcon } from 'phosphor-react-native/src/icons/Wrench';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { XCircleIcon } from 'phosphor-react-native/src/icons/XCircle';
import type { Icon as PhosphorIcon, IconWeight } from 'phosphor-react-native';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * Legacy (Ionicons) names on the left so existing screens need no edits, plus
 * the semantic names new screens use. Several legacy names collapse onto one
 * glyph — Phosphor has no outline/solid split, weight carries that instead.
 */
const GLYPHS = {
  /* navigation & chrome */
  'chevron-back': CaretLeftIcon,
  'chevron-forward': CaretRightIcon,
  'chevron-down': CaretDownIcon,
  'chevron-up': CaretUpIcon,
  'arrow-forward': ArrowRightIcon,
  'arrow-back': ArrowLeftIcon,
  'ellipsis-horizontal': DotsThreeIcon,
  close: XIcon,
  'close-circle': XCircleIcon,
  checkmark: CheckIcon,
  'checkmark-circle': CheckCircleIcon,
  'checkmark-done': ChecksIcon,
  search: MagnifyingGlassIcon,
  refresh: ArrowsClockwiseIcon,
  settings: GearSixIcon,
  'grid-outline': GridFourIcon,
  'list-outline': ListBulletsIcon,
  plus: PlusIcon,
  minus: MinusIcon,
  trash: TrashIcon,
  pencil: PencilSimpleIcon,
  resize: SelectionAllIcon,
  circle: CircleIcon,
  'ellipse-outline': CircleIcon,

  /* people & roles */
  people: UsersIcon,
  'people-outline': UsersIcon,
  person: UserIcon,
  'person-outline': UserIcon,
  'person-circle': UserCircleIcon,
  'person-circle-outline': UserCircleIcon,
  hammer: HammerIcon,
  'hammer-outline': HammerIcon,
  business: BuildingsIcon,
  'business-outline': BuildingsIcon,
  storefront: StorefrontIcon,

  /* work — the glyphs the job categories map onto */
  briefcase: BriefcaseIcon,
  'hard-hat': HardHatIcon,
  broom: BroomIcon,
  truck: TruckIcon,
  wrench: WrenchIcon,
  package: PackageIcon,
  tree: TreeIcon,
  'spray-bottle': SprayBottleIcon,
  confetti: ConfettiIcon,
  reader: ReceiptIcon,
  'reader-outline': ReceiptIcon,
  clipboard: ClipboardTextIcon,
  pricetag: TagIcon,

  /* money */
  wallet: WalletIcon,
  'wallet-outline': WalletIcon,
  cash: MoneyIcon,
  'cash-outline': MoneyIcon,
  card: CreditCardIcon,
  coins: CoinsIcon,
  'currency-circle': CurrencyCircleDollarIcon,

  /* status & feedback */
  notifications: BellIcon,
  'notifications-outline': BellIcon,
  'notifications-ringing': BellRingingIcon,
  alarm: AlarmIcon,
  star: StarIcon,
  'star-outline': StarIcon,
  heart: HeartIcon,
  ban: ProhibitIcon,
  tray: TrayIcon,
  'file-tray-outline': TrayIcon,
  ribbon: MedalIcon,
  'shield-checkmark': ShieldCheckIcon,
  'alert-circle-outline': WarningCircleIcon,
  warning: WarningIcon,
  info: InfoIcon,
  'cloud-offline-outline': CloudSlashIcon,
  sparkle: SparkleIcon,
  lightning: LightningIcon,
  'trending-up': TrendUpIcon,
  'trending-down': TrendDownIcon,
  'chart-line': ChartLineIcon,
  'list-checks': ListChecksIcon,

  /* time */
  time: ClockIcon,
  'time-outline': ClockIcon,
  hourglass: HourglassIcon,
  'calendar-outline': CalendarBlankIcon,

  /* place */
  location: MapPinIcon,
  'location-outline': MapPinIcon,
  crosshair: CrosshairIcon,
  home: HouseIcon,
  'home-outline': HouseIcon,

  /* comms */
  call: PhoneIcon,
  'call-outline': PhoneIcon,
  chatbubble: ChatCircleDotsIcon,
  'paper-plane': PaperPlaneTiltIcon,
  'globe-outline': GlobeIcon,
  radio: BroadcastIcon,
  wifi: WifiHighIcon,
  moon: MoonIcon,

  /* media & security */
  camera: CameraIcon,
  image: ImageIcon,
  'lock-closed': LockIcon,
  'lock-open': LockOpenIcon,
  'eye-outline': EyeIcon,
  'eye-off-outline': EyeSlashIcon,
  'sign-out': SignOutIcon,
} satisfies Record<string, PhosphorIcon>;

export type IconName = keyof typeof GLYPHS;

export interface IconProps {
  name: IconName;
  /** 24 is the system default; the grid steps are 16 / 20 / 24 / 32. */
  size?: number;
  color?: string;
  /** Duotone unless a glyph genuinely needs to read at a glance (timers). */
  weight?: IconWeight;
  /** Opacity of the duotone fill layer behind the stroke. */
  duotoneOpacity?: number;
  style?: StyleProp<ViewStyle>;
}

export function Icon({
  name,
  size = 24,
  color,
  weight = 'duotone',
  duotoneOpacity = 0.22,
  style,
}: IconProps) {
  const Glyph = GLYPHS[name];
  return (
    <Glyph
      size={size}
      color={color}
      weight={weight}
      duotoneOpacity={duotoneOpacity}
      style={style}
    />
  );
}

export { type IconWeight };
