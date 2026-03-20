"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { AREA_LABELS, type AreaKey } from "@/lib/constants";
import { getCanvasClothingImageSrc } from "@/lib/clothing-assets";
import { isComposedPreviewSource } from "@/lib/preview-source";
import { formatDateTimeIst } from "@/lib/time";
import { formatInr } from "@/lib/utils";
import { INDIA_STATE_CITY_OPTIONS, INDIA_STATES } from "@/lib/india-locations";
import { useAuthModal } from "@/components/auth/customer-auth-modal-provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const ACCOUNT_VISIBLE_AREAS: AreaKey[] = ["front", "back"];
const EMPTY_PREVIEW_DATA_URL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const ORDER_CANCEL_WINDOW_MS = 12 * 60 * 60 * 1000;

type SavedDraft = {
  id: string;
  productSlug: string;
  productName: string;
  colorName: string;
  sizeCode: string;
  selectedAreas: AreaKey[];
  previewImageUrls: Record<AreaKey, string>;
  updatedAt: string;
  approved3d: boolean;
};

type OrderHistoryItem = {
  id: string;
  orderCode: string;
  status: string;
  paymentState: string;
  totalInr: number;
  createdAt: string;
  shippedAt: string | null;
  quantity: number;
  lineTotalInr: number;
  productName: string;
  productSlug: string;
  sizeCode: string;
  colorName: string;
  colorCode: string;
  selectedAreas: AreaKey[];
  imageUrls: Record<AreaKey, string | null>;
  shippingContact: {
    customerName: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    line1: string;
    line2: string;
    landmark: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
};

type AccountData = {
  customer: {
    id: string;
    loginId: string | null;
    email: string | null;
    phone: string | null;
    fullName: string;
    shippingAddress: {
      line1: string;
      line2: string;
      landmark: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    };
    createdAt: string;
  };
  savedDrafts: SavedDraft[];
  orders: OrderHistoryItem[];
};

type ProfileFormState = {
  customerName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function createProfileForm(customer: AccountData["customer"]): ProfileFormState {
  return {
    customerName: customer.fullName ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    line1: customer.shippingAddress.line1,
    line2: customer.shippingAddress.line2,
    landmark: customer.shippingAddress.landmark,
    city: customer.shippingAddress.city,
    state: customer.shippingAddress.state,
    postalCode: customer.shippingAddress.postalCode,
    country: customer.shippingAddress.country || "India",
  };
}

async function readResponseJson<T extends Record<string, unknown>>(response: Response) {
  const text = await response.text();
  if (!text) {
    return {} as Partial<T> & { error?: unknown };
  }

  try {
    return JSON.parse(text) as Partial<T> & { error?: unknown };
  } catch {
    return {} as Partial<T> & { error?: unknown };
  }
}

function responseErrorMessage(data: { error?: unknown }, fallback: string) {
  if (typeof data.error !== "string") {
    return fallback;
  }

  const value = data.error.trim();
  return value.length > 0 ? value : fallback;
}

function encodeAreas(areas: AreaKey[]) {
  return encodeURIComponent(areas.join(","));
}

function getDraftBasePreviewSrc(productSlug: string, area: AreaKey) {
  if (typeof productSlug !== "string" || productSlug.trim().length === 0) {
    return null;
  }

  if (area !== "front" && area !== "back") {
    return null;
  }

  return getCanvasClothingImageSrc(productSlug, area)
    ?? getCanvasClothingImageSrc(productSlug, "front")
    ?? null;
}

function hasMeaningfulPreviewSource(source?: string) {
  if (typeof source !== "string") {
    return false;
  }

  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return false;
  }

  return trimmed !== EMPTY_PREVIEW_DATA_URL;
}

function isOrderWithinCancelWindow(createdAt: string) {
  const createdAtDate = new Date(createdAt);
  if (Number.isNaN(createdAtDate.getTime())) {
    return false;
  }

  return Date.now() - createdAtDate.getTime() <= ORDER_CANCEL_WINDOW_MS;
}

export function CustomerAccountDashboard() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { openAuthModal } = useAuthModal();
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const [buyingAgainOrderId, setBuyingAgainOrderId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [confirmingCancelOrderId, setConfirmingCancelOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCustomer = status === "authenticated" && session?.user.role === "CUSTOMER";

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/customer/account", { cache: "no-store" });
      const data = await readResponseJson<AccountData>(response);
      if (!response.ok) {
        throw new Error(responseErrorMessage(data, "Unable to load account data."));
      }
      setAccountData(data as AccountData);
    } catch (loadError) {
      setAccountData(null);
      setError(loadError instanceof Error ? loadError.message : "Unable to load account data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isCustomer) {
      setAccountData(null);
      setProfileForm(null);
      setEditingProfile(false);
      return;
    }

    void loadAccount();
  }, [isCustomer, loadAccount]);

  useEffect(() => {
    if (!accountData) {
      setProfileForm(null);
      return;
    }
    setProfileForm(createProfileForm(accountData.customer));
  }, [accountData]);

  const availableProfileCities = useMemo(() => {
    if (!profileForm) {
      return [];
    }
    return INDIA_STATE_CITY_OPTIONS[profileForm.state] ?? [];
  }, [profileForm]);

  const onBuyDraft = (draft: SavedDraft) => {
    const areas = encodeAreas(draft.selectedAreas);
    router.push(`/customize/${draft.productSlug}/preview?draftId=${draft.id}&areas=${areas}`);
  };

  const onEditDraft = (draft: SavedDraft) => {
    const areas = encodeAreas(draft.selectedAreas);
    router.push(`/customize/${draft.productSlug}?draftId=${draft.id}&areas=${areas}&step=5`);
  };

  const onDeleteDraft = async (draftId: string) => {
    if (typeof window !== "undefined") {
      const shouldDelete = window.confirm("Delete this draft? This will permanently remove saved files and records.");
      if (!shouldDelete) {
        return;
      }
    }

    setDeletingDraftId(draftId);
    setError(null);

    try {
      const response = await fetch(`/api/designs/draft/${draftId}`, {
        method: "DELETE",
      });
      const data = await readResponseJson<{ deleted: boolean }>(response);
      if (!response.ok || data.deleted !== true) {
        throw new Error(responseErrorMessage(data, "Unable to delete draft."));
      }

      setAccountData((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          savedDrafts: previous.savedDrafts.filter((draft) => draft.id !== draftId),
        };
      });
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete draft.");
    } finally {
      setDeletingDraftId((previous) => (previous === draftId ? null : previous));
    }
  };

  const onBuyAgain = async (orderId: string) => {
    setBuyingAgainOrderId(orderId);
    setError(null);

    try {
      const response = await fetch(`/api/customer/orders/${orderId}/buy-again`, {
        method: "POST",
      });
      const data = await readResponseJson<{ checkoutPath: string }>(response);
      if (!response.ok || typeof data.checkoutPath !== "string") {
        throw new Error(responseErrorMessage(data, "Unable to prepare buy again draft."));
      }

      router.push(data.checkoutPath);
    } catch (buyAgainError) {
      setError(buyAgainError instanceof Error ? buyAgainError.message : "Unable to prepare buy again draft.");
    } finally {
      setBuyingAgainOrderId(null);
    }
  };

  const onConfirmCancelOrder = (orderId: string) => {
    setConfirmingCancelOrderId(orderId);
    setError(null);
  };

  const onDismissCancelOrder = () => {
    setConfirmingCancelOrderId(null);
  };

  const onCancelOrder = async (order: OrderHistoryItem) => {
    setCancellingOrderId(order.id);
    setError(null);

    try {
      const response = await fetch(`/api/customer/orders/${order.id}/cancel`, {
        method: "POST",
      });
      const data = await readResponseJson<{ cancelled: boolean }>(response);
      if (!response.ok || data.cancelled !== true) {
        throw new Error(responseErrorMessage(data, "Unable to cancel order."));
      }

      setAccountData((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          orders: previous.orders.filter((item) => item.id !== order.id),
        };
      });
      setConfirmingCancelOrderId((previous) => (previous === order.id ? null : previous));
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Unable to cancel order.");
    } finally {
      setCancellingOrderId((previous) => (previous === order.id ? null : previous));
    }
  };

  const onStartEditProfile = () => {
    if (!accountData) {
      return;
    }
    setError(null);
    setProfileForm(createProfileForm(accountData.customer));
    setEditingProfile(true);
  };

  const onCancelEditProfile = () => {
    if (accountData) {
      setProfileForm(createProfileForm(accountData.customer));
    }
    setEditingProfile(false);
  };

  const onSaveProfile = async () => {
    if (!profileForm) {
      return;
    }

    setSavingProfile(true);
    setError(null);

    try {
      const selectedStateCities = INDIA_STATE_CITY_OPTIONS[profileForm.state] ?? [];
      if (selectedStateCities.length === 0) {
        throw new Error("Please select a valid state in India.");
      }

      if (!selectedStateCities.includes(profileForm.city)) {
        throw new Error("Please select a valid city for the selected state.");
      }

      const response = await fetch("/api/customer/account", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName: profileForm.customerName,
          email: profileForm.email,
          phone: profileForm.phone,
          address: {
            line1: profileForm.line1,
            line2: profileForm.line2,
            landmark: profileForm.landmark,
            city: profileForm.city,
            state: profileForm.state,
            postalCode: profileForm.postalCode,
            country: profileForm.country || "India",
          },
        }),
      });

      const data = await readResponseJson<{ customer: AccountData["customer"] }>(response);
      if (!response.ok || !data.customer) {
        throw new Error(responseErrorMessage(data, "Unable to update shipping/contact information."));
      }

      setAccountData((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          customer: data.customer as AccountData["customer"],
        };
      });
      setEditingProfile(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update shipping/contact information.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (status === "loading") {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[#000000]">Loading account...</p>
        </CardBody>
      </Card>
    );
  }

  if (!isCustomer) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Login required</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-[#000000]">
            Log in to access your saved drafts, purchase history, and shipping/contact information.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                openAuthModal({
                  mode: "login",
                  reason: "Log in to access your account.",
                })}
            >
              Log In
            </Button>
            <Button onClick={() => openAuthModal({ mode: "signup" })} variant="ghost">
              Sign Up
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Account Overview</h2>
            {!editingProfile ? (
              <Button variant="ghost" onClick={onStartEditProfile}>
                Edit
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-[#000000]">
          <p>
            <strong>Login ID:</strong> {accountData?.customer.loginId ?? accountData?.customer.email ?? accountData?.customer.phone ?? "-"}
          </p>
          {editingProfile && profileForm ? (
            <div className="space-y-3 rounded-xl border border-[#ffffff]/80 bg-[#ffffff]/70 p-3">
              <p className="font-medium text-[#000000]">Shipping & Contact Information</p>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  required
                  placeholder="Full name"
                  value={profileForm.customerName}
                  onChange={(event) => setProfileForm((prev) => (prev ? { ...prev, customerName: event.target.value } : prev))}
                />
                <Input
                  required
                  type="email"
                  placeholder="Email"
                  value={profileForm.email}
                  onChange={(event) => setProfileForm((prev) => (prev ? { ...prev, email: event.target.value } : prev))}
                />
                <Input
                  required
                  placeholder="Phone"
                  value={profileForm.phone}
                  onChange={(event) => setProfileForm((prev) => (prev ? { ...prev, phone: event.target.value } : prev))}
                />
                <Input
                  required
                  placeholder="Address line 1"
                  value={profileForm.line1}
                  onChange={(event) => setProfileForm((prev) => (prev ? { ...prev, line1: event.target.value } : prev))}
                />
                <Input
                  placeholder="Address line 2"
                  value={profileForm.line2}
                  onChange={(event) => setProfileForm((prev) => (prev ? { ...prev, line2: event.target.value } : prev))}
                />
                <Input
                  placeholder="Landmark"
                  value={profileForm.landmark}
                  onChange={(event) => setProfileForm((prev) => (prev ? { ...prev, landmark: event.target.value } : prev))}
                />
                <div className="space-y-1">
                  <label className="block text-xs text-[#000000]/60">State</label>
                  <Select
                    required
                    value={profileForm.state}
                    onChange={(event) => {
                      const state = event.target.value;
                      setProfileForm((prev) => (prev ? { ...prev, state, city: "" } : prev));
                    }}
                  >
                    <option value="" disabled>
                      Select state
                    </option>
                    {INDIA_STATES.map((stateName) => (
                      <option key={stateName} value={stateName}>
                        {stateName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs text-[#000000]/60">City</label>
                  <Select
                    required
                    value={profileForm.city}
                    disabled={!profileForm.state}
                    onChange={(event) => setProfileForm((prev) => (prev ? { ...prev, city: event.target.value } : prev))}
                  >
                    <option value="" disabled>
                      {profileForm.state ? "Select city" : "Select state first"}
                    </option>
                    {availableProfileCities.map((cityName) => (
                      <option key={cityName} value={cityName}>
                        {cityName}
                      </option>
                    ))}
                  </Select>
                </div>
                <Input
                  required
                  placeholder="PIN Code"
                  value={profileForm.postalCode}
                  onChange={(event) => setProfileForm((prev) => (prev ? { ...prev, postalCode: event.target.value } : prev))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void onSaveProfile()} disabled={savingProfile}>
                  {savingProfile ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="ghost" onClick={onCancelEditProfile} disabled={savingProfile}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[#ffffff]/80 bg-[#ffffff]/70 p-3">
              <p className="font-medium text-[#000000]">Shipping & Contact Information</p>
              <p>{accountData?.customer.fullName || "-"}</p>
              <p>{accountData?.customer.email ?? "-"}</p>
              <p>{accountData?.customer.phone ?? "-"}</p>
              <p>
                {accountData?.customer.shippingAddress.line1 || "-"}
                {accountData?.customer.shippingAddress.line2 ? `, ${accountData.customer.shippingAddress.line2}` : ""}
                {accountData?.customer.shippingAddress.landmark ? `, ${accountData.customer.shippingAddress.landmark}` : ""}
              </p>
              <p>
                {accountData?.customer.shippingAddress.city || "-"}, {accountData?.customer.shippingAddress.state || "-"}{" "}
                {accountData?.customer.shippingAddress.postalCode || "-"}, {accountData?.customer.shippingAddress.country || "India"}
              </p>
            </div>
          )}
          {error && <p className="text-danger">{error}</p>}
          {loading && <p className="text-[#000000]">Refreshing...</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Saved Drafts</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          {accountData?.savedDrafts.length ? (
            accountData.savedDrafts.map((draft) => {
              const isDeletingDraft = deletingDraftId === draft.id;

              return (
                <div key={draft.id} className="rounded-xl border border-[#000000]/20 bg-[#ffffff]/70 p-4 space-y-3">
                  <p className="text-sm font-semibold">{draft.productName}</p>
                  <p className="text-xs text-[#000000]">
                    Color: {draft.colorName} | Size: {draft.sizeCode} | Saved: {formatDateTimeIst(draft.updatedAt)}
                  </p>
                  <p className="text-xs text-[#000000]">
                    Areas: {draft.selectedAreas.filter((area) => ACCOUNT_VISIBLE_AREAS.includes(area)).map((area) => AREA_LABELS[area]).join(", ")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ACCOUNT_VISIBLE_AREAS.map((area) => {
                      const basePreviewSrc = getDraftBasePreviewSrc(draft.productSlug, area);
                      const overlayPreviewSrc = draft.previewImageUrls[area];
                      const composedPreviewSrc = isComposedPreviewSource(overlayPreviewSrc)
                        ? overlayPreviewSrc
                        : null;
                      const hasOverlayPreviewSrc = hasMeaningfulPreviewSource(overlayPreviewSrc);
                      const finalPreviewSrc = composedPreviewSrc ?? (hasOverlayPreviewSrc ? overlayPreviewSrc as string : null);
                      const previewInsetClass = "absolute inset-[2.5%]";
                      const previewImageClass = "object-contain";

                      return (
                        <div key={`${draft.id}-${area}`} className="overflow-hidden rounded-lg border border-[#ffffff]/80 bg-[#ffffff]/80">
                          {finalPreviewSrc ? (
                            <div className="relative aspect-square w-full bg-[#ffffff]">
                              <div className={previewInsetClass}>
                                <Image
                                  src={finalPreviewSrc}
                                  alt={`${draft.id}-${area}`}
                                  fill
                                  unoptimized
                                  className={previewImageClass}
                                />
                              </div>
                            </div>
                          ) : basePreviewSrc ? (
                            <div className="relative aspect-square w-full bg-[#ffffff]">
                              <div className={previewInsetClass}>
                                <Image
                                  src={basePreviewSrc}
                                  alt={`${draft.productName}-${area}-base`}
                                  fill
                                  className={previewImageClass}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex aspect-square w-full items-center justify-center text-xs text-[#000000]">No preview</div>
                          )}
                          <p className="px-2 py-1 text-[11px] text-[#000000]">{AREA_LABELS[area]}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => onBuyDraft(draft)} disabled={isDeletingDraft}>
                      Preview and Buy
                    </Button>
                    <Button variant="ghost" onClick={() => onEditDraft(draft)} disabled={isDeletingDraft}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => void onDeleteDraft(draft.id)} disabled={isDeletingDraft}>
                      {isDeletingDraft ? "Deleting..." : "Delete Draft"}
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-[#000000]">No saved drafts yet.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Previous Purchase History</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          {accountData?.orders.length ? (
            accountData.orders.map((order) => {
              const isOrderWithinWindow = isOrderWithinCancelWindow(order.createdAt);
              const canCancelOrder = order.status !== "CANCELLED" && isOrderWithinWindow;
              const isConfirmingCancel = confirmingCancelOrderId === order.id;
              const isCancelling = cancellingOrderId === order.id;

              return (
                <div key={order.id} className="rounded-xl border border-[#000000]/20 bg-[#ffffff]/70 p-4 space-y-3">
                  <div className="space-y-1 text-sm text-[#000000]">
                    <p className="font-semibold">{order.orderCode}</p>
                    <p>
                      {order.productName} | Color: {order.colorName} | Size: {order.sizeCode} | Quantity: {order.quantity}
                    </p>
                    <p>
                      Ordered: {formatDateTimeIst(order.createdAt)}
                      {order.shippedAt ? ` | Shipped: ${formatDateTimeIst(order.shippedAt)}` : " | Shipped: Pending"}
                    </p>
                    <p>
                      Status: {order.status} | Payment: {order.paymentState} | Total: {formatInr(order.totalInr)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#ffffff]/80 bg-[#ffffff]/80 p-3 text-xs text-[#000000]">
                    <p className="font-medium text-[#000000]">Shipping & Contact</p>
                    <p>{order.shippingContact.customerName}</p>
                    <p>{order.shippingContact.email}</p>
                    <p>{order.shippingContact.phone}</p>
                    <p>
                      {order.shippingAddress.line1}
                      {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
                      {order.shippingAddress.landmark ? `, ${order.shippingAddress.landmark}` : ""}
                    </p>
                    <p>
                      {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode},{" "}
                      {order.shippingAddress.country}
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {ACCOUNT_VISIBLE_AREAS.map((area) => {
                      const orderImageSrc = order.imageUrls[area];
                      const hasOrderImage = hasMeaningfulPreviewSource(orderImageSrc ?? undefined);
                      const basePreviewSrc = getDraftBasePreviewSrc(order.productSlug, area);
                      const finalPreviewSrc = hasOrderImage ? orderImageSrc : basePreviewSrc;
                      const previewInsetClass = "absolute inset-[2.5%]";
                      const previewImageClass = "object-contain";

                      return (
                        <div key={`${order.id}-${area}`} className="overflow-hidden rounded-lg border border-[#ffffff]/80 bg-[#ffffff]/80">
                          {finalPreviewSrc ? (
                            <div className="relative aspect-square w-full bg-[#ffffff]">
                              <div className={previewInsetClass}>
                                <Image
                                  src={finalPreviewSrc}
                                  alt={`${order.orderCode}-${area}`}
                                  fill
                                  unoptimized
                                  className={previewImageClass}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex aspect-square w-full items-center justify-center text-xs text-[#000000]">No image</div>
                          )}
                          <p className="px-2 py-1 text-[11px] text-[#000000]">{AREA_LABELS[area]}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => void onBuyAgain(order.id)} disabled={buyingAgainOrderId === order.id || isCancelling}>
                      {buyingAgainOrderId === order.id ? "Preparing..." : "Buy Again"}
                    </Button>
                    {canCancelOrder && !isConfirmingCancel ? (
                      <Button variant="danger" onClick={() => onConfirmCancelOrder(order.id)} disabled={isCancelling}>
                        Cancel Order
                      </Button>
                    ) : null}
                  </div>

                  {isConfirmingCancel ? (
                    <div className="space-y-2 rounded-lg border border-[#000000]/20 bg-[#ffffff]/80 p-3 text-sm text-[#000000]">
                      <p>
                        Are you sure you want to cancel order with order id (&quot;{order.orderCode}&quot;)?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="danger" onClick={() => void onCancelOrder(order)} disabled={isCancelling}>
                          {isCancelling ? "Cancelling..." : "Yes, Cancel"}
                        </Button>
                        <Button variant="ghost" onClick={onDismissCancelOrder} disabled={isCancelling}>
                          No
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-[#000000]">No purchases yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}




