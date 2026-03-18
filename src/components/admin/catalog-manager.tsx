"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Variant = {
  id: string;
  productTypeId: string;
  colorName: string;
  sizeCode: string;
  basePriceInr: number;
  active: boolean;
};

type PrintArea = {
  id: string;
  productTypeId: string;
  code: string;
  addonPriceInr: number;
};

type ProductType = {
  id: string;
  name: string;
};

export function CatalogManager({
  productTypes,
  variants,
  printAreas,
  flatShippingInr,
}: {
  productTypes: ProductType[];
  variants: Variant[];
  printAreas: PrintArea[];
  flatShippingInr: number;
}) {
  const [shipping, setShipping] = useState(flatShippingInr);
  const [variantDrafts, setVariantDrafts] = useState(variants);
  const [areaDrafts, setAreaDrafts] = useState(printAreas);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(
    () =>
      productTypes.map((productType) => ({
        productType,
        variants: variantDrafts.filter((variant) => variant.productTypeId === productType.id),
        printAreas: areaDrafts.filter((area) => area.productTypeId === productType.id),
      })),
    [productTypes, variantDrafts, areaDrafts],
  );

  const saveCatalog = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/admin/catalog", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          flatShippingInr: shipping,
          variants: variantDrafts.map((variant) => ({
            id: variant.id,
            basePriceInr: Number(variant.basePriceInr),
            active: variant.active,
          })),
          printAreas: areaDrafts.map((area) => ({
            id: area.id,
            addonPriceInr: Number(area.addonPriceInr),
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save catalog.");
      }

      setMessage("Catalog updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save catalog.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Global Pricing Config</h2>
        </CardHeader>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="max-w-[220px]">
            <label className="mb-1 block text-xs text-[#000000]/60">Flat Shipping INR</label>
            <Input type="number" value={shipping} onChange={(event) => setShipping(Number(event.target.value) || 0)} />
          </div>
          <Button onClick={saveCatalog} disabled={saving}>
            {saving ? "Saving..." : "Save Catalog"}
          </Button>
          {message && <p className="text-sm text-brand">{message}</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
        </CardBody>
      </Card>

      {grouped.map(({ productType, variants: groupedVariants, printAreas: groupedAreas }) => (
        <Card key={productType.id}>
          <CardHeader>
            <h2 className="text-lg font-semibold">{productType.name}</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium text-[#000000]/80">Variant prices</p>
              <div className="space-y-2">
                {groupedVariants.map((variant) => (
                  <div key={variant.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <span className="min-w-[150px]">{variant.colorName} / {variant.sizeCode}</span>
                    <Input
                      type="number"
                      value={variant.basePriceInr}
                      onChange={(event) =>
                        setVariantDrafts((prev) =>
                          prev.map((item) =>
                            item.id === variant.id ? { ...item, basePriceInr: Number(event.target.value) || 0 } : item,
                          ),
                        )
                      }
                      className="max-w-[120px]"
                    />
                    <label className="flex items-center gap-2 text-xs text-[#000000]/60">
                      <input
                        type="checkbox"
                        checked={variant.active}
                        onChange={(event) =>
                          setVariantDrafts((prev) =>
                            prev.map((item) =>
                              item.id === variant.id ? { ...item, active: event.target.checked } : item,
                            ),
                          )
                        }
                      />
                      Active
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-[#000000]/80">Print area add-ons</p>
              <div className="space-y-2">
                {groupedAreas.map((area) => (
                  <div key={area.id} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <span className="min-w-[160px]">{area.code}</span>
                    <Input
                      type="number"
                      value={area.addonPriceInr}
                      onChange={(event) =>
                        setAreaDrafts((prev) =>
                          prev.map((item) =>
                            item.id === area.id ? { ...item, addonPriceInr: Number(event.target.value) || 0 } : item,
                          ),
                        )
                      }
                      className="max-w-[120px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}




