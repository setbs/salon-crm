import { ArrowRight, Search, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  createAdminService,
  createAdminServiceCategory,
  deleteAdminService,
  deleteAdminServiceCategory,
  updateAdminService,
  updateAdminServiceCategory,
  type AdminData,
  type MeasurementUnit,
  type ServiceCategoryInput,
  type ServiceInput
} from "../../api";
import { AdminModal, DataTable, InlineActions, Panel, StatusBadge } from "../../components/admin-ui";
import { useCrmT } from "../../crm-i18n";
import { formatPlainNumber, formatUnit } from "../../utils/format";

type DisplayPrice = {
  price: number;
  priceFrom?: number | null;
  priceTo?: number | null;
};

function canUseProductInProcedure(product: { purpose?: "sale" | "procedure" | "both" }) {
  return !product.purpose || product.purpose === "procedure" || product.purpose === "both";
}

function formatHryvnia(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} ₴`;
}

function formatServicePrice(value: DisplayPrice) {
  const plainHryvnia = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  if (value.priceFrom !== null && value.priceFrom !== undefined && value.priceTo !== null && value.priceTo !== undefined) {
    return `${plainHryvnia.format(value.priceFrom)} - ${plainHryvnia.format(value.priceTo)} ₴`;
  }

  if (value.priceFrom !== null && value.priceFrom !== undefined) {
    return `from ${formatHryvnia(value.priceFrom)}`;
  }

  if (value.priceTo !== null && value.priceTo !== undefined) {
    return `up to ${formatHryvnia(value.priceTo)}`;
  }

  return formatHryvnia(value.price);
}

export function ServicesSection({
  services,
  categories,
  employees,
  products,
  runAction
}: {
  services: AdminData["services"];
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  products: AdminData["products"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useCrmT();
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [consumableFilter, setConsumableFilter] = useState("all");
  const [serviceSearch, setServiceSearch] = useState("");
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [collapsedServiceGroups, setCollapsedServiceGroups] = useState<string[]>([]);
  const editingService = services.find((service) => service.id === editingServiceId) ?? null;
  const editingCategory = categories.find((category) => category.id === editingCategoryId) ?? null;
  const normalizedServiceSearch = serviceSearch.trim().toLowerCase();
  const filteredServices = services.filter((service) => {
    const matchesCategory = categoryFilter === "all" || (categoryFilter === "" ? service.categoryId === null : service.categoryId === categoryFilter);
    const matchesEmployee =
      employeeFilter === "all" || (employeeFilter === "" ? service.employeeIds.length === 0 : service.employeeIds.includes(employeeFilter));
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? service.active : !service.active);
    const matchesConsumables =
      consumableFilter === "all" || (consumableFilter === "configured" ? service.consumables.length > 0 : service.consumables.length === 0);
    const matchesSearch =
      normalizedServiceSearch.length === 0 ||
      [
        service.name,
        service.description ?? "",
        service.category?.name ?? "Uncategorized",
        service.active ? "active" : "disabled",
        service.employees.map((employee) => `${employee.name} ${employee.specialization ?? ""}`).join(" "),
        service.consumables.map((consumable) => `${consumable.productName} ${consumable.productCategory ?? ""}`).join(" ")
      ].some((value) => value.toLowerCase().includes(normalizedServiceSearch));

    return matchesCategory && matchesEmployee && matchesStatus && matchesConsumables && matchesSearch;
  });
  const serviceGroups = buildServiceGroups(filteredServices, categories, categoryFilter);
  const serviceSummary = useMemo(() => buildServiceSummary(services), [services]);

  function toggleServiceGroup(groupId: string) {
    setCollapsedServiceGroups((current) => (current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]));
  }

  function renderServiceActions(item: AdminData["services"][number]) {
    return (
      <InlineActions
        labels={[item.active ? t("disable") : t("enable"), t("edit"), ...(item.canDelete ? [t("delete")] : [])]}
        onAction={(label) => {
          if (label === t("edit")) {
            setEditingServiceId(item.id);
            return;
          }

          if (label === t("delete")) {
            void runAction(() => deleteAdminService(item.id));
            return;
          }

          void runAction(() => updateAdminService(item.id, { active: !item.active }));
        }}
      />
    );
  }

  return (
    <div className="admin-grid">
      <Panel title={t("serviceCategories")} action={t("addCategory")} onAction={() => setIsCreatingCategory(true)} wide>
        <DataTable
          columns={[t("name"), t("description"), t("status"), t("actions")]}
          rows={categories.map((category) => [
            category.name,
            category.description ?? t("noDescription"),
            <StatusBadge status={category.active ? "active" : "disabled"} />,
            <InlineActions
              labels={[category.active ? t("disable") : t("enable"), t("edit"), t("delete")]}
              onAction={(label) => {
                if (label === t("edit")) {
                  setEditingCategoryId(category.id);
                  return;
                }

                if (label === t("delete")) {
                  void runAction(() => deleteAdminServiceCategory(category.id));
                  return;
                }

                void runAction(() => updateAdminServiceCategory(category.id, { active: !category.active }));
              }}
            />
          ])}
        />
      </Panel>
      <Panel title={t("services")} action={t("addService")} onAction={() => setIsCreatingService(true)} wide>
        <div className="service-summary-grid">
          <article>
            <span>{t("totalServices")}</span>
            <strong>{serviceSummary.total}</strong>
            <small>{filteredServices.length} {t("visibleWithFilters")}</small>
          </article>
          <article>
            <span>{t("active")}</span>
            <strong>{serviceSummary.active}</strong>
            <small>{serviceSummary.disabled} {t("disabled")}</small>
          </article>
          <article>
            <span>{t("assigned")}</span>
            <strong>{serviceSummary.assigned}</strong>
            <small>{serviceSummary.unassigned} {t("withoutSpecialist")}</small>
          </article>
          <article>
            <span>{t("consumables")}</span>
            <strong>{serviceSummary.withConsumables}</strong>
            <small>{serviceSummary.withoutConsumables} {t("withoutMaterials")}</small>
          </article>
        </div>
        <div className="table-toolbar">
          <label>
            <span>{t("search")}</span>
            <div className="admin-search table-search">
              <Search aria-hidden="true" size={17} />
              <input placeholder={t("serviceSearchPlaceholder")} value={serviceSearch} onChange={(event) => setServiceSearch(event.target.value)} />
            </div>
          </label>
          <label>
            <span>{t("categoryFilter")}</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">{t("allCategories")}</option>
              <option value="">{t("uncategorized")}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("specialistFilter")}</span>
            <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
              <option value="all">{t("allSpecialists")}</option>
              <option value="">{t("unassigned")}</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("statusFilter")}</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">{t("allStatuses")}</option>
              <option value="active">{t("active")}</option>
              <option value="disabled">{t("disabled")}</option>
            </select>
          </label>
          <label>
            <span>{t("consumablesFilter")}</span>
            <select value={consumableFilter} onChange={(event) => setConsumableFilter(event.target.value)}>
              <option value="all">{t("allServices")}</option>
              <option value="configured">{t("withConsumables")}</option>
              <option value="not_set">{t("withoutConsumables")}</option>
            </select>
          </label>
        </div>
        <div className="service-groups">
          {serviceGroups.length > 0 ? (
            serviceGroups.map((group) => {
              const isOpen = !collapsedServiceGroups.includes(group.id);

              return (
                <section className="service-group" key={group.id}>
                  <button
                    aria-expanded={isOpen}
                    className="service-group-toggle"
                    onClick={() => toggleServiceGroup(group.id)}
                    type="button"
                  >
                    <span className={isOpen ? "service-group-arrow open" : "service-group-arrow"}>
                      <ArrowRight aria-hidden="true" size={16} />
                    </span>
                    <strong>{group.id === "uncategorized" ? t("uncategorized") : group.name}</strong>
                    <span>{group.services.length} {t("services")}</span>
                  </button>
                  {isOpen ? (
                    group.services.length > 0 ? (
                      <DataTable
                        columns={[t("name"), t("description"), t("specialists"), t("price"), t("duration"), t("consumables"), t("history"), t("status"), t("actions")]}
                        rows={group.services.map((item) => [
                          item.name,
                          item.description || "-",
                          item.employees.length > 0 ? item.employees.map((employee) => employee.name).join(", ") : t("notAssigned"),
                          formatServicePrice(item),
                          `${item.duration} ${t("minutesShort")}`,
                          formatConsumables(item.consumables, t("notSet")),
                          item.appointmentCount > 0 ? `${item.appointmentCount} ${t("appointments")}` : t("noAppointmentsSmall"),
                          <StatusBadge status={item.active ? "active" : "disabled"} />,
                          renderServiceActions(item)
                        ])}
                      />
                    ) : (
                      <div className="empty-state">{t("noServicesInCategory")}</div>
                    )
                  ) : null}
                </section>
              );
            })
          ) : (
            <div className="empty-state">{t("noServicesMatchFilters")}</div>
          )}
        </div>
      </Panel>
      {isCreatingCategory ? (
        <AdminModal title={t("newCategory")} onClose={() => setIsCreatingCategory(false)}>
          <ServiceCategoryForm
            onCancel={() => setIsCreatingCategory(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminServiceCategory(payload);
                setIsCreatingCategory(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingCategory ? (
        <AdminModal title={`${t("editCategory")}: ${editingCategory.name}`} onClose={() => setEditingCategoryId(null)}>
          <ServiceCategoryEditForm
            category={editingCategory}
            key={editingCategory.id}
            onCancel={() => setEditingCategoryId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminServiceCategory(editingCategory.id, payload);
                setEditingCategoryId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
      {isCreatingService ? (
        <AdminModal title={t("newService")} onClose={() => setIsCreatingService(false)}>
          <ServiceForm
            categories={categories}
            employees={employees}
            products={products}
            onCancel={() => setIsCreatingService(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminService(payload);
                setIsCreatingService(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingService ? (
        <AdminModal title={`${t("editService")}: ${editingService.name}`} onClose={() => setEditingServiceId(null)}>
          <ServiceEditForm
            categories={categories}
            employees={employees}
            products={products}
            key={editingService.id}
            service={editingService}
            onCancel={() => setEditingServiceId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminService(editingService.id, payload);
                setEditingServiceId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
    </div>
  );
}

function buildServiceGroups(
  services: AdminData["services"],
  categories: AdminData["serviceCategories"],
  categoryFilter: string
) {
  const uncategorizedServices = services.filter((service) => !service.categoryId);

  if (categoryFilter === "") {
    return [
      {
        id: "uncategorized",
        name: "Uncategorized",
        services: uncategorizedServices
      }
    ];
  }

  if (categoryFilter !== "all") {
    const selectedCategory = categories.find((category) => category.id === categoryFilter);

    if (!selectedCategory) {
      return [];
    }

    return [
      {
        id: selectedCategory.id,
        name: selectedCategory.name,
        services: services.filter((service) => service.categoryId === selectedCategory.id)
      }
    ];
  }

  const groups = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      services: services.filter((service) => service.categoryId === category.id)
    }))
    .filter((group) => group.services.length > 0);

  if (uncategorizedServices.length > 0) {
    groups.push({
      id: "uncategorized",
      name: "Uncategorized",
      services: uncategorizedServices
    });
  }

  return groups;
}

function buildServiceSummary(services: AdminData["services"]) {
  return {
    total: services.length,
    active: services.filter((service) => service.active).length,
    disabled: services.filter((service) => !service.active).length,
    assigned: services.filter((service) => service.employeeIds.length > 0).length,
    unassigned: services.filter((service) => service.employeeIds.length === 0).length,
    withConsumables: services.filter((service) => service.consumables.length > 0).length,
    withoutConsumables: services.filter((service) => service.consumables.length === 0).length
  };
}
function ServiceCategoryForm({
  onCancel,
  onSubmit
}: {
  onCancel: () => void;
  onSubmit: (payload: ServiceCategoryInput) => Promise<void>;
}) {
  const t = useCrmT();
  const [form, setForm] = useState({ name: "", description: "", active: true });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      name: form.name,
      description: form.description,
      active: form.active
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>{t("name")}</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>{t("description")}</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <label className="checkbox-line">
        <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
        <span>{t("activeCategory")}</span>
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          {t("cancel")}
        </button>
        <button className="primary-button admin-submit" type="submit">
          {t("addCategory")}
        </button>
      </div>
    </form>
  );
}

function ServiceCategoryEditForm({
  category,
  onCancel,
  onSubmit
}: {
  category: AdminData["serviceCategories"][number];
  onCancel: () => void;
  onSubmit: (payload: ServiceCategoryInput) => Promise<void>;
}) {
  const t = useCrmT();
  const [form, setForm] = useState({
    name: category.name,
    description: category.description ?? "",
    active: category.active
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      name: form.name,
      description: form.description,
      active: form.active
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>{t("name")}</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>{t("description")}</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <label className="checkbox-line">
        <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
        <span>{t("activeCategory")}</span>
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          {t("cancel")}
        </button>
        <button className="primary-button admin-submit" type="submit">
          {t("saveCategory")}
        </button>
      </div>
    </form>
  );
}

function ServiceForm({
  categories,
  employees,
  onCancel,
  products,
  onSubmit
}: {
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  onCancel: () => void;
  products: AdminData["products"];
  onSubmit: (payload: ServiceInput) => Promise<void>;
}) {
  const t = useCrmT();
  const [form, setForm] = useState({
    categoryId: categories[0]?.id ?? "",
    name: "",
    price: "0",
    priceFrom: "",
    priceTo: "",
    duration: "60",
    description: "",
    active: true,
    employeeIds: employees[0]?.id ? [employees[0].id] : [],
    consumables: [] as ConsumableFormItem[]
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      categoryId: form.categoryId,
      name: form.name,
      price: Number(form.price),
      priceFrom: optionalPriceInput(form.priceFrom),
      priceTo: optionalPriceInput(form.priceTo),
      duration: Number(form.duration),
      description: form.description,
      active: form.active,
      employeeIds: form.employeeIds,
      consumables: toConsumablePayload(form.consumables)
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>{t("category")}</span>
        <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
          <option value="">{t("uncategorized")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("name")}</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>{t("basePrice")}</span>
        <input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
      </label>
      <label>
        <span>{t("priceFrom")}</span>
        <input type="number" min="0" value={form.priceFrom} onChange={(event) => setForm({ ...form, priceFrom: event.target.value })} />
      </label>
      <label>
        <span>{t("priceTo")}</span>
        <input type="number" min="0" value={form.priceTo} onChange={(event) => setForm({ ...form, priceTo: event.target.value })} />
      </label>
      <label>
        <span>{t("durationMin")}</span>
        <input type="number" min="1" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required />
      </label>
      <label>
        <span>{t("description")}</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <EmployeeSelector
        employees={employees}
        selectedIds={form.employeeIds}
        onChange={(employeeIds) => setForm({ ...form, employeeIds })}
      />
      <ConsumableSelector
        items={form.consumables}
        products={products}
        onChange={(consumables) => setForm({ ...form, consumables })}
      />
      {form.employeeIds.length === 0 ? <small className="form-note">{t("assignSpecialistHint")}</small> : null}
      <label className="checkbox-line">
        <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
        <span>{t("activeService")}</span>
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          {t("cancel")}
        </button>
        <button className="primary-button admin-submit" disabled={form.employeeIds.length === 0} type="submit">
          {t("addService")}
        </button>
      </div>
    </form>
  );
}

function ServiceEditForm({
  categories,
  employees,
  products,
  onCancel,
  onSubmit,
  service
}: {
  categories: AdminData["serviceCategories"];
  employees: AdminData["employees"];
  products: AdminData["products"];
  onCancel: () => void;
  onSubmit: (payload: ServiceInput) => Promise<void>;
  service: AdminData["services"][number];
}) {
  const t = useCrmT();
  const [form, setForm] = useState({
    categoryId: service.categoryId ?? "",
    name: service.name,
    price: String(service.price),
    priceFrom: service.priceFrom === null ? "" : String(service.priceFrom),
    priceTo: service.priceTo === null ? "" : String(service.priceTo),
    duration: String(service.duration),
    description: service.description ?? "",
    active: service.active,
    employeeIds: service.employeeIds,
    consumables: service.consumables.map((consumable) => ({
      productId: consumable.productId,
      quantity: String(consumable.quantity),
      unit: consumable.unit
    })) as ConsumableFormItem[]
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      categoryId: form.categoryId,
      name: form.name,
      price: Number(form.price),
      priceFrom: optionalPriceInput(form.priceFrom),
      priceTo: optionalPriceInput(form.priceTo),
      duration: Number(form.duration),
      description: form.description,
      active: form.active,
      employeeIds: form.employeeIds,
      consumables: toConsumablePayload(form.consumables)
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>{t("category")}</span>
        <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
          <option value="">{t("uncategorized")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("name")}</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>{t("basePrice")}</span>
        <input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
      </label>
      <label>
        <span>{t("priceFrom")}</span>
        <input type="number" min="0" value={form.priceFrom} onChange={(event) => setForm({ ...form, priceFrom: event.target.value })} />
      </label>
      <label>
        <span>{t("priceTo")}</span>
        <input type="number" min="0" value={form.priceTo} onChange={(event) => setForm({ ...form, priceTo: event.target.value })} />
      </label>
      <label>
        <span>{t("durationMin")}</span>
        <input type="number" min="1" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} required />
      </label>
      <label>
        <span>{t("description")}</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <EmployeeSelector
        employees={employees}
        selectedIds={form.employeeIds}
        onChange={(employeeIds) => setForm({ ...form, employeeIds })}
      />
      <ConsumableSelector
        items={form.consumables}
        products={products}
        onChange={(consumables) => setForm({ ...form, consumables })}
      />
      {form.employeeIds.length === 0 ? <small className="form-note">{t("assignSpecialistHint")}</small> : null}
      <label className="checkbox-line">
        <input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" />
        <span>{t("activeService")}</span>
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          {t("cancel")}
        </button>
        <button className="primary-button admin-submit" disabled={form.employeeIds.length === 0} type="submit">
          {t("saveService")}
        </button>
      </div>
    </form>
  );
}

function EmployeeSelector({
  employees,
  onChange,
  selectedIds
}: {
  employees: AdminData["employees"];
  onChange: (employeeIds: string[]) => void;
  selectedIds: string[];
}) {
  const t = useCrmT();
  function toggleEmployee(employeeId: string) {
    onChange(selectedIds.includes(employeeId) ? selectedIds.filter((id) => id !== employeeId) : [...selectedIds, employeeId]);
  }

  return (
    <div className="checkbox-group">
      <span>{t("specialists")}</span>
      {employees.length > 0 ? (
        employees.map((employee) => (
          <label className="checkbox-line" key={employee.id}>
            <input checked={selectedIds.includes(employee.id)} onChange={() => toggleEmployee(employee.id)} type="checkbox" />
            <span>{employee.specialization ? `${employee.name} · ${employee.specialization}` : employee.name}</span>
          </label>
        ))
      ) : (
        <small>{t("noEmployeesAvailable")}</small>
      )}
    </div>
  );
}

type ConsumableFormItem = {
  productId: string;
  quantity: string;
  unit: MeasurementUnit;
};

function ConsumableSelector({
  items,
  onChange,
  products
}: {
  items: ConsumableFormItem[];
  onChange: (items: ConsumableFormItem[]) => void;
  products: AdminData["products"];
}) {
  const t = useCrmT();
  const availableProducts = products.filter(canUseProductInProcedure);
  const defaultProductId = availableProducts[0]?.id ?? "";

  function addItem() {
    if (!defaultProductId) {
      return;
    }

    onChange([...items, { productId: defaultProductId, quantity: "1", unit: "ml" }]);
  }

  function updateItem(index: number, patch: Partial<ConsumableFormItem>) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="consumable-builder">
      <div className="consumable-builder-header">
        <span>{t("consumables")}</span>
        <button className="secondary-button compact-button" disabled={!defaultProductId} onClick={addItem} type="button">
          {t("addMaterial")}
        </button>
      </div>
      <small className="form-note">{t("internalServiceParameters")}</small>
      {availableProducts.length === 0 ? <small className="form-note">{t("noProcedureProducts")}</small> : null}
      {items.map((item, index) => (
        <div className="consumable-row" key={`${item.productId}-${index}`}>
          <label>
            <span>{t("product")}</span>
            <select value={item.productId} onChange={(event) => updateItem(index, { productId: event.target.value })}>
              {availableProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {formatProductOption(product)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("quantity")}</span>
            <input
              min="0.01"
              step="0.01"
              type="number"
              value={item.quantity}
              onChange={(event) => updateItem(index, { quantity: event.target.value })}
              required
            />
          </label>
          <label>
            <span>{t("unit")}</span>
            <select value={item.unit} onChange={(event) => updateItem(index, { unit: event.target.value as MeasurementUnit })}>
              <option value="ml">ml</option>
              <option value="gram">g</option>
            </select>
          </label>
          <button aria-label={t("remove")} className="icon-only-button" onClick={() => removeItem(index)} title={t("remove")} type="button">
            <Trash2 aria-hidden="true" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function toConsumablePayload(items: ConsumableFormItem[]): ServiceInput["consumables"] {
  return items
    .filter((item) => item.productId && Number(item.quantity) > 0)
    .map((item) => ({
      productId: item.productId,
      quantity: Number(item.quantity),
      unit: item.unit
    }));
}

function optionalPriceInput(value: string) {
  return value.trim() ? Number(value) : null;
}

function formatConsumables(consumables: AdminData["services"][number]["consumables"], emptyLabel = "not set") {
  if (consumables.length === 0) {
    return emptyLabel;
  }

  return consumables.map((consumable) => `${consumable.productName}: ${consumable.quantity} ${formatUnit(consumable.unit)}`).join(", ");
}

function formatProductOption(product: AdminData["products"][number]) {
  const content = product.contentAmount ? ` · ${formatPlainNumber(product.contentAmount)} ${formatUnit(product.contentUnit)}/pack` : "";
  return `${product.name}${content} · stock ${formatProductStock(product)}`;
}

function formatProductStock(product: AdminData["products"][number]) {
  if (product.stockContentAmount !== null && product.stockPackageEquivalent !== null && product.contentUnit) {
    return `${formatPlainNumber(product.stockPackageEquivalent)} packs · ${formatPlainNumber(product.stockContentAmount)} ${formatUnit(product.contentUnit)}`;
  }

  return String(product.stock);
}
