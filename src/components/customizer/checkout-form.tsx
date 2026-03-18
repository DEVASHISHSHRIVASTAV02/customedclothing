"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { v4 as uuidv4 } from "uuid";
import { AreaKey, AREA_LABELS, AREA_KEY_TO_CODE } from "@/lib/constants";
import { readPreviewSession, removePreviewSession } from "@/lib/client-session";
import { calculateDesignEditPricePerItemInr, getDesignEditCounts } from "@/lib/design-pricing";
import { formatInr } from "@/lib/utils";
import { INDIA_STATE_CITY_OPTIONS, INDIA_STATES } from "@/lib/india-locations";
import { useAuthModal } from "@/components/auth/customer-auth-modal-provider";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type CheckoutProductPayload = {
  productVariant: {
    id: string;
    sizeCode: string;
    colorName: string;
    basePriceInr: number;
    productType: {
      name: string;
      printAreas: {
        code: string;
        addonPriceInr: number;
      }[];
    };
  };
};

type CheckoutOrderSource
  = { type: "draft"; draftId: string }
    | { type: "session"; sessionId: string; productVariantId: string; approved3d: boolean };

type Props = {
  product: CheckoutProductPayload;
  orderSource: CheckoutOrderSource;
  selectedAreas: AreaKey[];
  shippingInr: number;
  designJsonByArea?: Partial<Record<AreaKey, unknown>>;
  step6Message?: string;
  initialForm?: Partial<FormState>;
};

type FormState = {
  customerName: string;
  email: string;
  phone: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  postalCode: string;
};

type AccountCheckoutAutofillResponse = {
  customer?: {
    fullName?: string;
    email?: string | null;
    phone?: string | null;
    shippingAddress?: {
      line1?: string;
      line2?: string;
      landmark?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    };
  };
};

const FLOW_BUTTON_WHITE_CLASS = "!border-[#000000] !bg-[#ffffff] !text-[#000000] hover:!border-[#000000] hover:!bg-[#000000] hover:!text-[#ffffff] active:!border-[#000000] active:!bg-[#000000] active:!text-[#ffffff] disabled:!border-[#000000]/20 disabled:!bg-[#ffffff] disabled:!text-[#000000]/45 disabled:hover:!border-[#000000]/20 disabled:hover:!bg-[#ffffff] disabled:hover:!text-[#000000]/45";
const AUTH_REQUIRED_WARNING = "You must sign in to place an order.";

const initialState: FormState = {
  customerName: "",
  email: "",
  phone: "",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  postalCode: "",
};

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

export function CheckoutForm({
  product,
  orderSource,
  selectedAreas,
  shippingInr,
  designJsonByArea,
  step6Message,
  initialForm,
}: Props) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const { openAuthModal } = useAuthModal();
  const [form, setForm] = useState<FormState>({
    ...initialState,
    ...(initialForm ?? {}),
  });
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authWarning, setAuthWarning] = useState<string | null>(null);
  const promptedForAuthRef = useRef(false);
  const attemptedAccountAutofillRef = useRef(false);
  const isCustomerSignedIn = sessionStatus === "authenticated" && session?.user.role === "CUSTOMER";

  const areaAddonTotal = useMemo(() => {
    const areaCodes = new Set<string>(selectedAreas.map((area) => AREA_KEY_TO_CODE[area]));
    return product.productVariant.productType.printAreas
      .filter((area) => areaCodes.has(area.code))
      .reduce((sum, area) => sum + area.addonPriceInr, 0);
  }, [product.productVariant.productType.printAreas, selectedAreas]);
  const designJsonByAreaForPricing = useMemo(() => {
    if (orderSource.type === "draft") {
      return designJsonByArea;
    }

    try {
      return readPreviewSession(orderSource.sessionId)?.designJsonByArea;
    } catch {
      return undefined;
    }
  }, [designJsonByArea, orderSource]);
  const designEditCounts = useMemo(
    () => getDesignEditCounts(designJsonByAreaForPricing, selectedAreas),
    [designJsonByAreaForPricing, selectedAreas],
  );
  const designEditPricePerItemInr = useMemo(
    () => calculateDesignEditPricePerItemInr(designJsonByAreaForPricing, selectedAreas),
    [designJsonByAreaForPricing, selectedAreas],
  );
  const step6MessageForSummary = useMemo(() => {
    if (orderSource.type === "draft") {
      return typeof step6Message === "string" ? step6Message.trim() : "";
    }

    try {
      return readPreviewSession(orderSource.sessionId)?.step6Message?.trim() ?? "";
    } catch {
      return "";
    }
  }, [orderSource, step6Message]);

  const subtotal = (product.productVariant.basePriceInr + areaAddonTotal + designEditPricePerItemInr) * quantity;
  const total = subtotal + shippingInr;
  const availableCities = useMemo(() => INDIA_STATE_CITY_OPTIONS[form.state] ?? [], [form.state]);

  const openCheckoutAuthModal = useCallback((mode: "signup" | "login" = "signup") => {
    openAuthModal({
      mode,
      reason: "Create an account or log in to continue with checkout.",
      onSuccess: () => {
        setAuthWarning(null);
        promptedForAuthRef.current = false;
      },
      onClose: () => {
        setAuthWarning(AUTH_REQUIRED_WARNING);
      },
    });
  }, [openAuthModal]);

  useEffect(() => {
    if (sessionStatus === "loading" || isCustomerSignedIn || promptedForAuthRef.current) {
      return;
    }

    promptedForAuthRef.current = true;
    openCheckoutAuthModal("signup");
  }, [sessionStatus, isCustomerSignedIn, openCheckoutAuthModal]);

  useEffect(() => {
    if (!isCustomerSignedIn || attemptedAccountAutofillRef.current) {
      return;
    }
    attemptedAccountAutofillRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/customer/account", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = await readResponseJson<AccountCheckoutAutofillResponse>(response);
        const customer = data.customer;
        if (!customer || cancelled) {
          return;
        }

        const shippingAddress = customer.shippingAddress ?? {};
        setForm((previous) => ({
          customerName: previous.customerName.trim().length > 0 ? previous.customerName : (customer.fullName?.trim() ?? ""),
          email: previous.email.trim().length > 0 ? previous.email : (customer.email?.trim() ?? ""),
          phone: previous.phone.trim().length > 0 ? previous.phone : (customer.phone?.trim() ?? ""),
          line1: previous.line1.trim().length > 0 ? previous.line1 : (shippingAddress.line1?.trim() ?? ""),
          line2: previous.line2.trim().length > 0 ? previous.line2 : (shippingAddress.line2?.trim() ?? ""),
          landmark: previous.landmark.trim().length > 0 ? previous.landmark : (shippingAddress.landmark?.trim() ?? ""),
          city: previous.city.trim().length > 0 ? previous.city : (shippingAddress.city?.trim() ?? ""),
          state: previous.state.trim().length > 0 ? previous.state : (shippingAddress.state?.trim() ?? ""),
          postalCode: previous.postalCode.trim().length > 0 ? previous.postalCode : (shippingAddress.postalCode?.trim() ?? ""),
        }));
      } catch {
        // Autofill is best-effort only.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isCustomerSignedIn]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (sessionStatus === "loading") {
      return;
    }

    if (!isCustomerSignedIn) {
      openCheckoutAuthModal("login");
      return;
    }

    setSubmitting(true);

    try {
      if (orderSource.type === "session" && !orderSource.approved3d) {
        throw new Error("Please approve the 3D preview before checkout.");
      }

      const selectedStateCities = INDIA_STATE_CITY_OPTIONS[form.state] ?? [];
      if (selectedStateCities.length === 0) {
        throw new Error("Please select a valid state in India.");
      }

      if (!selectedStateCities.includes(form.city)) {
        throw new Error("Please select a valid city for the selected state.");
      }

      const idempotencyKey = uuidv4();
      const basePayload = {
        quantity,
        selectedAreas,
        customerName: form.customerName,
        email: form.email,
        phone: form.phone,
        address: {
          line1: form.line1,
          line2: form.line2,
          landmark: form.landmark,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          country: "India",
        },
        idempotencyKey,
      };

      const requestBody = (() => {
        if (orderSource.type === "draft") {
          return {
            ...basePayload,
            draftId: orderSource.draftId,
            step6Message: step6MessageForSummary,
          };
        }

        const sessionSnapshot = readPreviewSession(orderSource.sessionId);
        if (!sessionSnapshot || sessionSnapshot.productVariantId !== orderSource.productVariantId) {
          throw new Error("Your unsaved design session expired. Please return to customization and continue again.");
        }

        return {
          ...basePayload,
          productVariantId: orderSource.productVariantId,
          previewImageUrls: sessionSnapshot.previewImageUrls,
          layerPreviewImageUrls: sessionSnapshot.layerPreviewImageUrls,
          designJsonByArea: sessionSnapshot.designJsonByArea,
          sourceDraftId: sessionSnapshot.sourceDraftId,
          step6Message: sessionSnapshot.step6Message,
          approved3d: orderSource.approved3d,
        };
      })();

      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const orderData = await readResponseJson<{ orderId: string }>(orderResponse);
      if (!orderResponse.ok) {
        throw new Error(responseErrorMessage(orderData, "Checkout failed."));
      }

      if (typeof orderData.orderId !== "string" || orderData.orderId.length === 0) {
        throw new Error("Checkout failed.");
      }

      if (orderSource.type === "session") {
        removePreviewSession(orderSource.sessionId);
      }

      router.push(`/order/confirmation/${orderData.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <form onSubmit={onSubmit} className="space-y-5">
        <Card>
          <CardHeader>
            <p className="text-xs uppercase tracking-[0.2em] text-[#000000]/60">Step 7</p>
            <h2 className="mt-1 text-lg font-semibold">Shipping & Contact</h2>
          </CardHeader>
          <CardBody className="grid gap-3 md:grid-cols-2">
            <Input required placeholder="Full name" value={form.customerName} onChange={(event) => setForm((prev) => ({ ...prev, customerName: event.target.value }))} />
            <Input required type="email" placeholder="Email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
            <Input required placeholder="Phone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
            <Input required placeholder="Address line 1" value={form.line1} onChange={(event) => setForm((prev) => ({ ...prev, line1: event.target.value }))} />
            <Input placeholder="Address line 2" value={form.line2} onChange={(event) => setForm((prev) => ({ ...prev, line2: event.target.value }))} />
            <Input placeholder="Landmark" value={form.landmark} onChange={(event) => setForm((prev) => ({ ...prev, landmark: event.target.value }))} />
            <div className="space-y-1">
              <label className="block text-xs text-[#000000]/60">State</label>
              <Select
                required
                value={form.state}
                onChange={(event) => {
                  const state = event.target.value;
                  setForm((prev) => ({ ...prev, state, city: "" }));
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
                value={form.city}
                disabled={!form.state}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              >
                <option value="" disabled>
                  {form.state ? "Select city" : "Select state first"}
                </option>
                {availableCities.map((cityName) => (
                  <option key={cityName} value={cityName}>
                    {cityName}
                  </option>
                ))}
              </Select>
            </div>
            <Input required placeholder="PIN Code" value={form.postalCode} onChange={(event) => setForm((prev) => ({ ...prev, postalCode: event.target.value }))} />
            <Input type="number" min={1} max={10} value={quantity} onChange={(event) => setQuantity(Number(event.target.value) || 1)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Payment Method</h2>
          </CardHeader>
          <CardBody>
            <div className="rounded-xl border border-[#ffffff]/80 bg-[#ffffff] px-3 py-2 text-sm text-[#000000]">
              Cash on Delivery is enabled at launch. Online gateway integration is already prepared for next phase.
            </div>
          </CardBody>
        </Card>

        {authWarning && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {authWarning}
          </p>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={submitting} className={`h-11 px-6 ${FLOW_BUTTON_WHITE_CLASS}`}>
          {submitting ? "Placing Order..." : "Place COD Order"}
        </Button>
      </form>

      <Card className="h-fit sticky top-6">
        <CardHeader>
          <h2 className="text-lg font-semibold">Order Summary</h2>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-[#000000]">
          <p>
            <strong>{product.productVariant.productType.name}</strong>
          </p>
          <p>Size: {product.productVariant.sizeCode}</p>
          <p>Color: {product.productVariant.colorName}</p>
          <p>Base: {formatInr(product.productVariant.basePriceInr)}</p>
          <p>Add-on per item: {formatInr(areaAddonTotal)}</p>
          <p>Design edits per item: {formatInr(designEditPricePerItemInr)}</p>
          <p className="text-xs text-[#000000]/70">
            Text: {designEditCounts.textEdits}, Image: {designEditCounts.imageEdits}, Paint: {designEditCounts.paintEdits}
          </p>
          <p>Shipping: {formatInr(shippingInr)}</p>
          <hr className="border-border" />
          <p className="font-semibold">Total: {formatInr(total)}</p>
          {step6MessageForSummary.length > 0 && (
            <div className="rounded-xl border border-[#ffffff]/80 bg-[#ffffff]/72 p-2 text-xs text-[#000000]">
              <p className="font-medium">Step 6 Message</p>
              <p className="mt-1 whitespace-pre-wrap">{step6MessageForSummary}</p>
            </div>
          )}
          <div className="rounded-xl border border-[#ffffff]/80 bg-[#ffffff]/72 p-2 text-xs text-[#000000]">
            {selectedAreas.map((area) => (
              <p key={area}>- {AREA_LABELS[area]}</p>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}






