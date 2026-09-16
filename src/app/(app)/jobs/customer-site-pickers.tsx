"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { customers, sites } from "@/db/schema";

type Customer = typeof customers.$inferSelect;
type Site = typeof sites.$inferSelect;

const NEW = "__new__";
const ONE_OFF = "__one_off__";

export function CustomerAndSitePickers({
  customers,
  sites,
  defaultCustomerId,
  defaultSiteId,
  defaultOneOffLocation,
  disabled,
}: {
  customers: Customer[];
  sites: Site[];
  defaultCustomerId?: string;
  defaultSiteId?: string;
  defaultOneOffLocation?: string | null;
  disabled?: boolean;
}) {
  const [customerSelection, setCustomerSelection] = useState(
    defaultCustomerId ?? "",
  );
  const [siteSelection, setSiteSelection] = useState(
    defaultSiteId ?? (defaultOneOffLocation ? ONE_OFF : ""),
  );
  const [oneOffLocationValue, setOneOffLocationValue] = useState(
    defaultOneOffLocation ?? "",
  );
  const isNewCustomer = customerSelection === NEW;
  const isNewSite = siteSelection === NEW;
  const isOneOff = siteSelection === ONE_OFF;

  const availableSites =
    customerSelection && !isNewCustomer
      ? sites.filter((site) => site.customerId === customerSelection)
      : [];

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="customerId">Customer</Label>
        <select
          id="customerId"
          value={customerSelection}
          disabled={disabled}
          onChange={(e) => {
            setCustomerSelection(e.target.value);
            setSiteSelection("");
            // A one-off location typed for the old customer doesn't
            // belong to the new one either — same reasoning as clearing
            // siteSelection above, just never applied here until now.
            setOneOffLocationValue("");
          }}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
          required
        >
          <option value="" disabled>
            Select or create a customer…
          </option>
          <option value={NEW}>+ Create new customer</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>

        {!isNewCustomer && customerSelection && (
          <input type="hidden" name="customerId" value={customerSelection} />
        )}

        {isNewCustomer && (
          <div className="space-y-2 rounded-md border p-3">
            <Input
              name="newCustomerName"
              placeholder="Customer name"
              required
              disabled={disabled}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                name="newCustomerPhone"
                placeholder="Phone"
                disabled={disabled}
              />
              <Input
                name="newCustomerEmail"
                type="email"
                placeholder="Email"
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="siteId">Site</Label>
        <select
          id="siteId"
          value={siteSelection}
          disabled={disabled}
          onChange={(e) => setSiteSelection(e.target.value)}
          className="w-full rounded-md border border-input px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">No site yet</option>
          <option value={ONE_OFF}>One-time location</option>
          <option value={NEW}>+ Add new site</option>
          {availableSites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>

        {!isNewSite && !isOneOff && siteSelection && (
          <input type="hidden" name="siteId" value={siteSelection} />
        )}

        {isOneOff && (
          <Input
            name="oneOffLocation"
            placeholder="Where is this job? (e.g. 123 Main St, Springfield)"
            value={oneOffLocationValue}
            onChange={(e) => setOneOffLocationValue(e.target.value)}
            disabled={disabled}
          />
        )}

        {isNewSite && (
          <div className="space-y-2 rounded-md border p-3">
            <Input
              name="newSiteName"
              placeholder="Location name (e.g. Main office)"
              required
              disabled={disabled}
            />
            <Input
              name="newSiteAddressLine1"
              placeholder="Address"
              disabled={disabled}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                name="newSiteCity"
                placeholder="City"
                disabled={disabled}
              />
              <Input
                name="newSitePostalCode"
                placeholder="Postal code"
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
