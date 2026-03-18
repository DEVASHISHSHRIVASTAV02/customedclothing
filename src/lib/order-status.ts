import { OrderStatus } from "@prisma/client";

const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
  PLACED: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PRODUCTION, OrderStatus.CANCELLED],
  PRODUCTION: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
  FAILED_NOTIFICATION: [OrderStatus.CONFIRMED, OrderStatus.PRODUCTION, OrderStatus.SHIPPED],
};

export function canTransitionStatus(fromStatus: OrderStatus, toStatus: OrderStatus) {
  if (fromStatus === toStatus) {
    return true;
  }
  return allowedTransitions[fromStatus].includes(toStatus);
}

export function nextOperationalStatus(fromStatus: OrderStatus): OrderStatus | null {
  switch (fromStatus) {
    case OrderStatus.PLACED:
      return OrderStatus.CONFIRMED;
    case OrderStatus.CONFIRMED:
      return OrderStatus.PRODUCTION;
    case OrderStatus.PRODUCTION:
      return OrderStatus.SHIPPED;
    case OrderStatus.SHIPPED:
      return OrderStatus.DELIVERED;
    default:
      return null;
  }
}

