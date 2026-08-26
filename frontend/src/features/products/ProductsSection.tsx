import { Package, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createAdminProduct,
  createAdminProductBrand,
  createAdminProductCategory,
  createAdminProductComponent,
  createAdminStockMovement,
  deleteAdminProduct,
  deleteAdminProductBrand,
  deleteAdminProductCategory,
  deleteAdminProductComponent,
  updateAdminProduct,
  updateAdminProductBrand,
  updateAdminProductCategory,
  updateAdminProductComponent,
  uploadAdminProductImage,
  type AdminData,
  type MeasurementUnit,
  type ProductBrandInput,
  type ProductCategoryInput,
  type ProductComponentInput,
  type ProductInput,
  type ProductPurpose,
  type StockMovementInput
} from "../../api";
import { AdminModal, DataTable, InlineActions, PaginationControls, Panel, StatusBadge } from "../../components/admin-ui";
import { useCrmT } from "../../crm-i18n";
import { adminMoney, formatPlainNumber, formatUnit } from "../../utils/format";

type StockMovementHistoryRow = {
  id: string;
  amount: string;
  brand: string | null;
  category: string;
  createdAt: string;
  product: string;
  reason: string | null;
  type: string;
};

const today = new Date().toISOString().slice(0, 10);
const PRODUCTS_PAGE_SIZE = 7;
const STOCK_MOVEMENT_PAGE_SIZE = 8;

function addDaysToDateString(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return [String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function ProductsSection({
  brands,
  categories,
  components,
  products,
  runAction
}: {
  brands: AdminData["productBrands"];
  categories: AdminData["productCategories"];
  components: AdminData["productComponents"];
  products: AdminData["products"];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useCrmT();
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingComponent, setIsCreatingComponent] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isCreatingStockMovement, setIsCreatingStockMovement] = useState(false);
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productBrandFilter, setProductBrandFilter] = useState("all");
  const [productPurposeFilter, setProductPurposeFilter] = useState("all");
  const [productSearch, setProductSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [isViewingStockHistory, setIsViewingStockHistory] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const editingBrand = brands.find((brand) => brand.id === editingBrandId) ?? null;
  const editingCategory = categories.find((category) => category.id === editingCategoryId) ?? null;
  const editingComponent = components.find((component) => component.id === editingComponentId) ?? null;
  const editingProduct = products.find((product) => product.id === editingProductId) ?? null;
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;
  const normalizedProductSearch = productSearch.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      productCategoryFilter === "all" ||
      (productCategoryFilter === "" ? product.categoryId === null : product.categoryId === productCategoryFilter);
    const matchesBrand = productBrandFilter === "all" || (productBrandFilter === "" ? product.brandId === null : product.brandId === productBrandFilter);
    const matchesPurpose = productPurposeFilter === "all" || product.purpose === productPurposeFilter;
    const matchesSearch =
      normalizedProductSearch.length === 0 ||
      [
        product.name,
        product.category,
        product.brand ?? "",
        product.sku ?? "",
        product.description ?? "",
        product.components.map((component) => `${component.name} ${component.description ?? ""}`).join(" "),
        formatProductPurpose(product.purpose, t)
      ].some((value) =>
        value.toLowerCase().includes(normalizedProductSearch)
      );

    return matchesCategory && matchesBrand && matchesPurpose && matchesSearch;
  });
  const productPageCount = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PAGE_SIZE));
  const currentProductPage = Math.min(productPage, productPageCount);
  const pagedProducts = filteredProducts.slice((currentProductPage - 1) * PRODUCTS_PAGE_SIZE, currentProductPage * PRODUCTS_PAGE_SIZE);
  const stockMovementRows = buildStockMovementHistoryRows(products);
  const latestStockMovementRows = stockMovementRows.slice(0, 4);
  const inventorySummary = useMemo(() => buildInventorySummary(products), [products]);

  useEffect(() => {
    setProductPage(1);
  }, [productBrandFilter, productCategoryFilter, productPurposeFilter, productSearch]);

  return (
    <div className="admin-grid">
      <Panel title={t("catalogSetup")} wide>
        <div className="compact-management-grid">
          <section className="compact-management-card">
            <div className="compact-management-header">
              <div>
                <p className="admin-kicker">{t("categories")}</p>
                <strong>{categories.length}</strong>
              </div>
              <button className="panel-action" onClick={() => setIsCreatingCategory(true)} type="button">
                + {t("addCategory")}
              </button>
            </div>
            <DataTable
              columns={[t("photo"), t("category"), t("products"), t("actions")]}
              rows={
                categories.length > 0
                  ? categories.map((category) => [
                      <span className="product-category-thumb">{category.imageUrl ? <img alt="" src={category.imageUrl} /> : <Package aria-hidden="true" size={16} />}</span>,
                      category.name,
                      String(category.productCount),
                      <InlineActions
                        labels={[t("edit"), t("delete")]}
                        onAction={(label) => {
                          if (label === t("edit")) {
                            setEditingCategoryId(category.id);
                            return;
                          }

                          void runAction(() => deleteAdminProductCategory(category.id));
                        }}
                      />
                    ])
                  : [["-", t("noCategoriesYet"), "-", "-"]]
              }
            />
          </section>

          <section className="compact-management-card">
            <div className="compact-management-header">
              <div>
                <p className="admin-kicker">{t("brands")}</p>
                <strong>{brands.length}</strong>
              </div>
              <button className="panel-action" onClick={() => setIsCreatingBrand(true)} type="button">
                + {t("addBrand")}
              </button>
            </div>
            <DataTable
              columns={[t("brand"), t("products"), t("actions")]}
              rows={
                brands.length > 0
                  ? brands.map((brand) => [
                      brand.name,
                      String(brand.productCount),
                      <InlineActions
                        labels={[t("edit"), t("delete")]}
                        onAction={(label) => {
                          if (label === t("edit")) {
                            setEditingBrandId(brand.id);
                            return;
                          }

                          void runAction(() => deleteAdminProductBrand(brand.id));
                        }}
                      />
                    ])
                : [[t("noBrandsYet"), "-", "-"]]
              }
            />
          </section>

          <section className="compact-management-card">
            <div className="compact-management-header">
              <div>
                <p className="admin-kicker">{t("components")}</p>
                <strong>{components.length}</strong>
              </div>
              <button className="panel-action" onClick={() => setIsCreatingComponent(true)} type="button">
                + {t("addComponent")}
              </button>
            </div>
            <DataTable
              columns={[t("component"), t("products"), t("actions")]}
              rows={
                components.length > 0
                  ? components.map((component) => [
                      component.name,
                      String(component.productCount),
                      <InlineActions
                        labels={[t("edit"), t("delete")]}
                        onAction={(label) => {
                          if (label === t("edit")) {
                            setEditingComponentId(component.id);
                            return;
                          }

                          void runAction(() => deleteAdminProductComponent(component.id));
                        }}
                      />
                    ])
                  : [[t("noComponentsYet"), "-", "-"]]
              }
            />
          </section>
        </div>
      </Panel>
      <Panel title={t("productsInventory")} action={t("addProduct")} onAction={() => setIsCreatingProduct(true)} wide>
        <div className="inventory-summary-grid">
          <article>
            <span>{t("totalProducts")}</span>
            <strong>{inventorySummary.totalProducts}</strong>
            <small>{inventorySummary.trackedProducts} {t("trackedInStock")}</small>
          </article>
          <article>
            <span>{t("lowStock")}</span>
            <strong>{inventorySummary.lowStockProducts}</strong>
            <small>{inventorySummary.outOfStockProducts} {t("outOfStock")}</small>
          </article>
          <article>
            <span>{t("procedureMaterials")}</span>
            <strong>{inventorySummary.procedureProducts}</strong>
            <small>{t("productsUsedInServices")}</small>
          </article>
          <article>
            <span>{t("retailStockValue")}</span>
            <strong>{adminMoney.format(inventorySummary.retailValue)}</strong>
            <small>{t("estimatedBySalePrice")}</small>
          </article>
        </div>
        <div className="table-toolbar">
          <label>
            <span>{t("search")}</span>
            <div className="admin-search table-search">
              <Search aria-hidden="true" size={17} />
              <input placeholder={t("nameSkuBrand")} value={productSearch} onChange={(event) => setProductSearch(event.target.value)} />
            </div>
          </label>
          <label>
            <span>{t("categoryFilter")}</span>
            <select value={productCategoryFilter} onChange={(event) => setProductCategoryFilter(event.target.value)}>
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
            <span>{t("brandFilter")}</span>
            <select value={productBrandFilter} onChange={(event) => setProductBrandFilter(event.target.value)}>
              <option value="all">{t("allBrands")}</option>
              <option value="">{t("noBrand")}</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("purposeFilter")}</span>
            <select value={productPurposeFilter} onChange={(event) => setProductPurposeFilter(event.target.value)}>
              <option value="all">{t("allPurposes")}</option>
              <option value="sale">{t("forSale")}</option>
              <option value="procedure">{t("forProcedures")}</option>
              <option value="both">{t("both")}</option>
            </select>
          </label>
        </div>
        <DataTable
          columns={[t("category"), t("brand"), t("purpose"), t("product"), t("margin"), t("stock"), t("package"), t("boost"), t("status"), t("actions")]}
          rows={
            pagedProducts.length > 0
              ? pagedProducts.map((item) => {
                  const stockLevel = getProductStockLevel(item);

                  return [
                    item.category,
                    item.brand || "-",
                    formatProductPurpose(item.purpose, t),
                    <button className="table-link-button" onClick={() => setSelectedProductId(item.id)} type="button">
                      {item.name}
                    </button>,
                    formatProductMargin(item),
                    stockLevel === "low" || stockLevel === "out" ? <span className="danger-text">{formatProductStock(item)}</span> : formatProductStock(item),
                    item.contentAmount ? `${formatPlainNumber(item.contentAmount)} ${formatUnit(item.contentUnit)}` : t("notSet"),
                    item.popularityBoost > 0 ? `+${item.popularityBoost}` : "-",
                    <StatusBadge status={stockLevel} />,
                    <InlineActions
                      labels={[t("details"), t("edit"), t("delete")]}
                      onAction={(label) => {
                        if (label === t("details")) {
                          setSelectedProductId(item.id);
                          return;
                        }

                        if (label === t("edit")) {
                          setEditingProductId(item.id);
                          return;
                        }

                        void runAction(() => deleteAdminProduct(item.id));
                      }}
                    />
                  ];
                })
              : [[t("noProductsMatchFilters"), "-", "-", "-", "-", "-", "-", "-", "-", "-"]]
          }
        />
        <PaginationControls currentPage={currentProductPage} label={`${filteredProducts.length} ${t("products")}`} onPageChange={setProductPage} pageCount={productPageCount} />
      </Panel>
      <Panel title={t("stockMovementHistory")} action={t("addMovement")} onAction={() => setIsCreatingStockMovement(true)} wide>
        <div className="stock-history-summary">
          <div>
            <p className="admin-kicker">{t("inventoryLogistics")}</p>
            <strong>{stockMovementRows.length} {t("movements")}</strong>
            <span>{t("stockMovementHelp")}</span>
          </div>
          <button className="secondary-button compact-button" onClick={() => setIsViewingStockHistory(true)} type="button">
            {t("viewFullHistory")}
          </button>
        </div>
        <DataTable
          columns={[t("date"), t("type"), t("product"), t("amount"), t("reason")]}
          rows={
            latestStockMovementRows.length > 0
              ? latestStockMovementRows.map((movement) => [
                  formatStockMovementDateTime(movement.createdAt),
                  movement.type,
                  movement.product,
                  movement.amount,
                  movement.reason || "-"
                ])
              : [[t("noStockMovementsYet"), "-", "-", "-", "-"]]
          }
        />
      </Panel>
      {isCreatingBrand ? (
        <AdminModal title={t("newProductBrand")} onClose={() => setIsCreatingBrand(false)}>
          <ProductBrandForm
            onCancel={() => setIsCreatingBrand(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminProductBrand(payload);
                setIsCreatingBrand(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingBrand ? (
        <AdminModal title={`${t("editBrand")}: ${editingBrand.name}`} onClose={() => setEditingBrandId(null)}>
          <ProductBrandForm
            brand={editingBrand}
            key={editingBrand.id}
            onCancel={() => setEditingBrandId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminProductBrand(editingBrand.id, payload);
                setEditingBrandId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
      {isCreatingComponent ? (
        <AdminModal title={t("newKeyComponent")} onClose={() => setIsCreatingComponent(false)}>
          <ProductComponentForm
            onCancel={() => setIsCreatingComponent(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminProductComponent(payload);
                setIsCreatingComponent(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingComponent ? (
        <AdminModal title={`${t("editComponent")}: ${editingComponent.name}`} onClose={() => setEditingComponentId(null)}>
          <ProductComponentForm
            component={editingComponent}
            key={editingComponent.id}
            onCancel={() => setEditingComponentId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminProductComponent(editingComponent.id, payload);
                setEditingComponentId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
      {isCreatingCategory ? (
        <AdminModal title={t("newProductCategory")} onClose={() => setIsCreatingCategory(false)}>
          <ProductCategoryForm
            onCancel={() => setIsCreatingCategory(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminProductCategory(payload);
                setIsCreatingCategory(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingCategory ? (
        <AdminModal title={`${t("editCategory")}: ${editingCategory.name}`} onClose={() => setEditingCategoryId(null)}>
          <ProductCategoryForm
            category={editingCategory}
            key={editingCategory.id}
            onCancel={() => setEditingCategoryId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminProductCategory(editingCategory.id, payload);
                setEditingCategoryId(null);
              })
            }
          />
        </AdminModal>
      ) : null}
      {isCreatingProduct ? (
        <AdminModal title={t("newProduct")} onClose={() => setIsCreatingProduct(false)}>
          <ProductForm
            brands={brands}
            categories={categories}
            components={components}
            onCancel={() => setIsCreatingProduct(false)}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminProduct(payload);
                setIsCreatingProduct(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {editingProduct ? (
        <AdminModal title={`${t("editProduct")}: ${editingProduct.name}`} onClose={() => setEditingProductId(null)}>
          <ProductForm
            brands={brands}
            categories={categories}
            components={components}
            key={editingProduct.id}
            onCancel={() => setEditingProductId(null)}
            onSubmit={(payload) =>
              runAction(async () => {
                await updateAdminProduct(editingProduct.id, payload);
                setEditingProductId(null);
              })
            }
            product={editingProduct}
          />
        </AdminModal>
      ) : null}
      {isCreatingStockMovement ? (
        <AdminModal title={t("stockMovement")} onClose={() => setIsCreatingStockMovement(false)}>
          <StockMovementForm
            onCancel={() => setIsCreatingStockMovement(false)}
            products={products}
            onSubmit={(payload) =>
              runAction(async () => {
                await createAdminStockMovement(payload);
                setIsCreatingStockMovement(false);
              })
            }
          />
        </AdminModal>
      ) : null}
      {isViewingStockHistory ? <StockMovementHistoryModal movements={stockMovementRows} onClose={() => setIsViewingStockHistory(false)} /> : null}
      {selectedProduct ? (
        <ProductInventoryModal
          onClose={() => setSelectedProductId(null)}
          onDelete={() =>
            runAction(async () => {
              await deleteAdminProduct(selectedProduct.id);
              setSelectedProductId(null);
            })
          }
          onEdit={() => {
            setEditingProductId(selectedProduct.id);
            setSelectedProductId(null);
          }}
          product={selectedProduct}
          runAction={runAction}
        />
      ) : null}
    </div>
  );
}

function ProductBrandForm({
  brand,
  onCancel,
  onSubmit
}: {
  brand?: AdminData["productBrands"][number];
  onCancel: () => void;
  onSubmit: (payload: ProductBrandInput) => Promise<void>;
}) {
  const t = useCrmT();
  const [form, setForm] = useState({
    name: brand?.name ?? "",
    description: brand?.description ?? ""
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void onSubmit({
      name: form.name,
      description: form.description || undefined
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>{t("brandName")}</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>{t("description")}</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          {t("cancel")}
        </button>
        <button className="primary-button admin-submit" type="submit">
          {brand ? t("saveBrand") : t("createBrand")}
        </button>
      </div>
    </form>
  );
}

function ProductComponentForm({
  component,
  onCancel,
  onSubmit
}: {
  component?: AdminData["productComponents"][number];
  onCancel: () => void;
  onSubmit: (payload: ProductComponentInput) => Promise<void>;
}) {
  const t = useCrmT();
  const [form, setForm] = useState({
    name: component?.name ?? "",
    description: component?.description ?? ""
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void onSubmit({
      name: form.name,
      description: form.description || undefined
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>{t("componentName")}</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>{t("description")}</span>
        <textarea
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
          placeholder={t("componentPlaceholder")}
          rows={7}
        />
      </label>
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          {t("cancel")}
        </button>
        <button className="primary-button admin-submit" type="submit">
          {component ? t("saveComponent") : t("createComponent")}
        </button>
      </div>
    </form>
  );
}

function ProductCategoryForm({
  category,
  onCancel,
  onSubmit
}: {
  category?: AdminData["productCategories"][number];
  onCancel: () => void;
  onSubmit: (payload: ProductCategoryInput) => Promise<void>;
}) {
  const t = useCrmT();
  const [form, setForm] = useState({
    name: category?.name ?? "",
    description: category?.description ?? "",
    imageUrl: category?.imageUrl ?? ""
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function uploadFile(file: File | null) {
    if (!file) {
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const result = await uploadAdminProductImage(file);
      setForm((current) => ({ ...current, imageUrl: result.imageUrl }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("couldNotUploadImage"));
    } finally {
      setIsUploading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    void onSubmit({
      name: form.name,
      description: form.description || undefined,
      imageUrl: form.imageUrl
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>{t("categoryName")}</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>{t("description")}</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
      </label>
      <label>
        <span>{t("categoryPhoto")}</span>
        <input accept="image/jpeg,image/png,image/webp,image/gif" disabled={isUploading} onChange={(event) => void uploadFile(event.target.files?.[0] ?? null)} type="file" />
      </label>
      {uploadError ? <p className="form-note">{uploadError}</p> : null}
      {form.imageUrl ? (
        <div className="portfolio-form-preview">
          <img alt={t("productCategoryPreview")} src={form.imageUrl} />
        </div>
      ) : null}
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          {t("cancel")}
        </button>
        <button className="primary-button admin-submit" disabled={isUploading || !form.imageUrl} type="submit">
          {isUploading ? t("uploading") : category ? t("saveCategory") : t("createCategory")}
        </button>
      </div>
    </form>
  );
}

function ProductForm({
  brands,
  categories,
  components,
  onCancel,
  onSubmit,
  product
}: {
  brands: AdminData["productBrands"];
  categories: AdminData["productCategories"];
  components: AdminData["productComponents"];
  onCancel?: () => void;
  onSubmit: (payload: ProductInput) => Promise<void>;
  product?: AdminData["products"][number];
}) {
  const t = useCrmT();
  const initialComponentIds = product?.components.map((component) => component.id) ?? [];
  const [form, setForm] = useState({
    categoryId: product?.categoryId ?? categories[0]?.id ?? "",
    brandId: product?.brandId ?? brands[0]?.id ?? "",
    category: product?.category ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    quote: product?.quote ?? "",
    brand: product?.brand ?? "",
    sku: product?.sku ?? "",
    imageUrl: product?.imageUrl ?? "",
    purpose: product?.purpose ?? ("both" as ProductPurpose),
    purchase: String(product?.purchase ?? 0),
    sale: String(product?.sale ?? 0),
    stock: String(product?.stock ?? 0),
    min: String(product?.min ?? 0),
    popularityBoost: String(product?.popularityBoost ?? 0),
    contentAmount: product?.contentAmount ? String(product.contentAmount) : "",
    contentUnit: product?.contentUnit ?? ("ml" as MeasurementUnit),
    componentIds: initialComponentIds
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function uploadFile(file: File | null) {
    if (!file) {
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const result = await uploadAdminProductImage(file);
      setForm((current) => ({ ...current, imageUrl: result.imageUrl }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : t("couldNotUploadImage"));
    } finally {
      setIsUploading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      categoryId: categories.length > 0 ? form.categoryId : undefined,
      category: categories.length > 0 ? undefined : form.category,
      brandId: brands.length > 0 ? form.brandId : undefined,
      name: form.name,
      description: form.description,
      quote: form.quote,
      brand: brands.length > 0 ? undefined : form.brand || undefined,
      sku: form.sku || undefined,
      imageUrl: form.imageUrl,
      purpose: form.purpose,
      purchase: Number(form.purchase),
      sale: Number(form.sale),
      stock: Number(form.stock),
      min: Number(form.min),
      popularityBoost: Number(form.popularityBoost),
      contentAmount: form.contentAmount ? Number(form.contentAmount) : undefined,
      contentUnit: form.contentAmount ? form.contentUnit : undefined,
      componentIds: form.componentIds
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      {categories.length > 0 ? (
        <label>
          <span>{t("category")}</span>
          <select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required>
            <option value="">{t("selectCategory")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          <span>{t("category")}</span>
          <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required />
        </label>
      )}
      <label>
        <span>{t("product")}</span>
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </label>
      <label>
        <span>{t("description")}</span>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={6} />
      </label>
      {brands.length > 0 ? (
        <label>
          <span>{t("brand")}</span>
          <select value={form.brandId} onChange={(event) => setForm({ ...form, brandId: event.target.value })} required>
            <option value="">{t("selectBrand")}</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          <span>{t("brand")}</span>
          <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
        </label>
      )}
      <label>
        <span>{t("productQuote")}</span>
        <textarea value={form.quote} onChange={(event) => setForm({ ...form, quote: event.target.value })} placeholder={t("productQuotePlaceholder")} rows={3} />
      </label>
      <fieldset className="component-picker">
        <legend>{t("keyComponents")}</legend>
        {components.length > 0 ? (
          <div className="component-picker-grid">
            {components.map((component) => {
              const checked = form.componentIds.includes(component.id);

              return (
                <label className="checkbox-line component-option" key={component.id}>
                  <input
                    checked={checked}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        componentIds: event.target.checked
                          ? [...current.componentIds, component.id]
                          : current.componentIds.filter((componentId) => componentId !== component.id)
                      }))
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>{component.name}</strong>
                    {component.description ? <small>{component.description}</small> : null}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="form-note">{t("componentHint")}</p>
        )}
      </fieldset>
      <label>
        <span>{t("sku")}</span>
        <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
      </label>
      <label>
        <span>{t("purpose")}</span>
        <select value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value as ProductPurpose })}>
          <option value="sale">{t("forSale")}</option>
          <option value="procedure">{t("forProcedures")}</option>
          <option value="both">{t("both")}</option>
        </select>
      </label>
      <label>
        <span>{t("productPhoto")}</span>
        <input accept="image/jpeg,image/png,image/webp,image/gif" disabled={isUploading} onChange={(event) => void uploadFile(event.target.files?.[0] ?? null)} type="file" />
      </label>
      {uploadError ? <p className="form-note">{uploadError}</p> : null}
      {form.imageUrl ? (
        <div className="portfolio-form-preview">
          <img alt={t("productPreview")} src={form.imageUrl} />
        </div>
      ) : null}
      <label>
        <span>{t("purchasePrice")}</span>
        <input type="number" min="0" value={form.purchase} onChange={(event) => setForm({ ...form, purchase: event.target.value })} />
      </label>
      <label>
        <span>{t("salePrice")}</span>
        <input type="number" min="0" value={form.sale} onChange={(event) => setForm({ ...form, sale: event.target.value })} required />
      </label>
      <label>
        <span>{t("stock")}</span>
        <input type="number" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required />
      </label>
      <label>
        <span>{t("minimumStock")}</span>
        <input type="number" min="0" value={form.min} onChange={(event) => setForm({ ...form, min: event.target.value })} required />
      </label>
      <label>
        <span>{t("popularityBoost")}</span>
        <input type="number" min="0" max="1000" step="1" value={form.popularityBoost} onChange={(event) => setForm({ ...form, popularityBoost: event.target.value })} />
        <small className="form-hint">{t("popularityBoostHint")}</small>
      </label>
      <label>
        <span>{t("packageContent")}</span>
        <input type="number" min="0.01" step="0.01" value={form.contentAmount} onChange={(event) => setForm({ ...form, contentAmount: event.target.value })} placeholder="60" />
      </label>
      <label>
        <span>{t("contentUnit")}</span>
        <select value={form.contentUnit} onChange={(event) => setForm({ ...form, contentUnit: event.target.value as MeasurementUnit })}>
          <option value="ml">ml</option>
          <option value="gram">g</option>
        </select>
      </label>
      <div className="form-actions">
        {onCancel ? (
          <button className="secondary-button compact-button" onClick={onCancel} type="button">
            {t("cancel")}
          </button>
        ) : null}
        <button
          className="primary-button admin-submit"
          disabled={isUploading || !form.imageUrl || (categories.length > 0 ? !form.categoryId : !form.category.trim()) || (brands.length > 0 ? !form.brandId : false)}
          type="submit"
        >
          {isUploading ? t("uploading") : product ? t("saveProduct") : t("addProduct")}
        </button>
      </div>
    </form>
  );
}

function StockMovementForm({
  onCancel,
  onSubmit,
  products
}: {
  onCancel: () => void;
  onSubmit: (payload: StockMovementInput) => Promise<void>;
  products: AdminData["products"];
}) {
  const t = useCrmT();
  const initialProduct = products[0];
  const [form, setForm] = useState({
    categoryId: initialProduct?.categoryId ?? "",
    productId: initialProduct?.id ?? "",
    movementType: "purchase" as StockMovementInput["movementType"],
    amountMode: "packages" as StockMovementInput["amountMode"],
    amount: "1",
    reason: ""
  });
  const productCategories = useMemo(() => {
    const categoryMap = new Map<string, string>();

    products.forEach((product) => {
      const categoryId = product.categoryId ?? "";
      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, product.category || t("uncategorized"));
      }
    });

    return Array.from(categoryMap, ([id, name]) => ({ id, name })).sort((left, right) => {
      if (left.id === "") {
        return 1;
      }

      if (right.id === "") {
        return -1;
      }

      return left.name.localeCompare(right.name);
    });
  }, [products]);
  const categoryProducts = products.filter((product) => (product.categoryId ?? "") === form.categoryId);
  const selectedProduct = categoryProducts.find((product) => product.id === form.productId) ?? categoryProducts[0];
  const canUseContent = Boolean(selectedProduct?.contentAmount && selectedProduct.contentUnit);

  useEffect(() => {
    const categoryExists = productCategories.some((category) => category.id === form.categoryId);
    const nextCategoryId = categoryExists ? form.categoryId : productCategories[0]?.id ?? "";
    const nextCategoryProducts = products.filter((product) => (product.categoryId ?? "") === nextCategoryId);
    const productExists = nextCategoryProducts.some((product) => product.id === form.productId);

    if (nextCategoryId !== form.categoryId || !productExists) {
      setForm((current) => ({
        ...current,
        categoryId: nextCategoryId,
        productId: nextCategoryProducts[0]?.id ?? ""
      }));
    }
  }, [form.categoryId, form.productId, productCategories, products]);

  useEffect(() => {
    if (form.amountMode === "content" && !canUseContent) {
      setForm((current) => ({ ...current, amountMode: "packages" }));
    }
  }, [canUseContent, form.amountMode]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct) {
      return;
    }

    void onSubmit({
      productId: form.productId,
      movementType: form.movementType,
      amountMode: form.amountMode,
      amount: Number(form.amount),
      reason: form.reason || undefined
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <label>
        <span>{t("category")}</span>
        <select
          value={form.categoryId}
          onChange={(event) => {
            const categoryId = event.target.value;
            const firstProduct = products.find((product) => (product.categoryId ?? "") === categoryId);
            setForm({ ...form, categoryId, productId: firstProduct?.id ?? "" });
          }}
        >
          {productCategories.map((category) => (
            <option key={category.id || "uncategorized"} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("product")}</span>
        <select value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} required>
          {categoryProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {formatProductOption(product)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("movementType")}</span>
        <select value={form.movementType} onChange={(event) => setForm({ ...form, movementType: event.target.value as StockMovementInput["movementType"] })}>
          <option value="purchase">{t("purchase")}</option>
          <option value="adjustment">{t("adjustment")}</option>
          <option value="return">{t("return")}</option>
        </select>
      </label>
      <label>
        <span>{t("amountMode")}</span>
        <select value={form.amountMode} onChange={(event) => setForm({ ...form, amountMode: event.target.value as StockMovementInput["amountMode"] })}>
          <option value="packages">{t("packages")}</option>
          <option value="content" disabled={!canUseContent}>
            {selectedProduct?.contentUnit ? formatUnit(selectedProduct.contentUnit) : "ml/g"}
          </option>
        </select>
      </label>
      <label>
        <span>{form.amountMode === "content" ? `${t("amount")}, ${formatUnit(selectedProduct?.contentUnit)}` : t("packages")}</span>
        <input step={form.amountMode === "content" ? "0.01" : "1"} type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
      </label>
      <label>
        <span>{t("reason")}</span>
        <textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} rows={3} />
      </label>
      {form.movementType === "adjustment" ? <small className="form-note">{t("adjustmentHint")}</small> : null}
      {!canUseContent ? <small className="form-note">{t("configurePackageContentHint")}</small> : null}
      <div className="form-actions">
        <button className="secondary-button compact-button" onClick={onCancel} type="button">
          {t("cancel")}
        </button>
        <button className="primary-button admin-submit" disabled={!selectedProduct} type="submit">
          {t("save")}
        </button>
      </div>
    </form>
  );
}

function StockMovementHistoryModal({ movements, onClose }: { movements: StockMovementHistoryRow[]; onClose: () => void }) {
  const t = useCrmT();
  const [period, setPeriod] = useState<"week" | "month" | "date" | "range">("week");
  const [selectedDate, setSelectedDate] = useState(today);
  const [rangeFrom, setRangeFrom] = useState(addDaysToDateString(today, -7));
  const [rangeTo, setRangeTo] = useState(today);
  const [page, setPage] = useState(1);
  const filteredMovements = movements.filter((movement) => {
    const movementDate = new Date(movement.createdAt);
    const movementDateKey = toDateTimeFields(movement.createdAt).date;

    if (period === "date") {
      return movementDateKey === selectedDate;
    }

    if (period === "range") {
      return movementDateKey >= rangeFrom && movementDateKey <= rangeTo;
    }

    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (period === "week" ? 7 : 30));

    return movementDate >= cutoff;
  });
  const pageCount = Math.max(1, Math.ceil(filteredMovements.length / STOCK_MOVEMENT_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedMovements = filteredMovements.slice((currentPage - 1) * STOCK_MOVEMENT_PAGE_SIZE, currentPage * STOCK_MOVEMENT_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [period, selectedDate, rangeFrom, rangeTo]);

  return (
    <AdminModal className="stock-history-modal" title={t("stockMovementHistory")} onClose={onClose}>
      <div className="table-toolbar">
        <label>
          <span>{t("period")}</span>
          <select value={period} onChange={(event) => setPeriod(event.target.value as "week" | "month" | "date" | "range")}>
            <option value="week">{t("lastWeek")}</option>
            <option value="month">{t("lastMonth")}</option>
            <option value="date">{t("specificDate")}</option>
            <option value="range">{t("dateRange")}</option>
          </select>
        </label>
        {period === "date" ? (
          <label>
            <span>{t("date")}</span>
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
        ) : null}
        {period === "range" ? (
          <>
            <label>
              <span>{t("from")}</span>
              <input type="date" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} />
            </label>
            <label>
              <span>{t("to")}</span>
              <input min={rangeFrom} type="date" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} />
            </label>
          </>
        ) : null}
      </div>
      <DataTable
        columns={[t("date"), t("time"), t("type"), t("category"), t("brand"), t("product"), t("amount"), t("reason")]}
        rows={
          pagedMovements.length > 0
            ? pagedMovements.map((movement) => [
                formatStockMovementDate(movement.createdAt),
                formatStockMovementTime(movement.createdAt),
                movement.type,
                movement.category,
                movement.brand || "-",
                movement.product,
                movement.amount,
                movement.reason || "-"
              ])
            : [[t("noStockMovementsForPeriod"), "-", "-", "-", "-", "-", "-", "-"]]
        }
      />
      <PaginationControls currentPage={currentPage} label={`${filteredMovements.length} ${t("movements")}`} onPageChange={setPage} pageCount={pageCount} />
    </AdminModal>
  );
}

function ProductInventoryModal({
  onClose,
  onDelete,
  onEdit,
  product,
  runAction
}: {
  onClose: () => void;
  onDelete: () => Promise<void>;
  onEdit: () => void;
  product: AdminData["products"][number];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useCrmT();
  const productMovements = buildStockMovementHistoryRows([product]);
  const latestMovements = productMovements.slice(0, 6);
  const stockLevel = getProductStockLevel(product);

  return (
    <AdminModal className="product-inventory-modal" title={t("productCard")} onClose={onClose}>
      <div className="product-inventory-detail">
        <section className="product-inventory-hero">
          <div className="product-inventory-image">
            {product.imageUrl ? <img alt={product.name} src={product.imageUrl} /> : <Package aria-hidden="true" size={30} />}
          </div>
          <div className="product-inventory-title">
            <p className="admin-kicker">{product.brand || t("noBrand")}</p>
            <h3>{product.name}</h3>
            <span>{product.description || t("noProductDescription")}</span>
          </div>
          <StatusBadge status={stockLevel} />
        </section>

        <div className="product-inventory-layout">
          <section className="product-inventory-panel">
            <div className="product-stat-grid">
              <div>
                <span>{t("category")}</span>
                <strong>{product.category}</strong>
              </div>
              <div>
                <span>{t("purpose")}</span>
                <strong>{formatProductPurpose(product.purpose, t)}</strong>
              </div>
              <div>
                <span>{t("sku")}</span>
                <strong>{product.sku || "-"}</strong>
              </div>
              <div>
                <span>{t("package")}</span>
                <strong>{product.contentAmount ? `${formatPlainNumber(product.contentAmount)} ${formatUnit(product.contentUnit)}` : t("notSet")}</strong>
              </div>
              <div>
                <span>{t("purchase")}</span>
                <strong>{adminMoney.format(product.purchase)}</strong>
              </div>
              <div>
                <span>{t("salePrice")}</span>
                <strong>{adminMoney.format(product.sale)}</strong>
              </div>
              <div>
                <span>{t("margin")}</span>
                <strong>{formatProductMargin(product)}</strong>
              </div>
              <div>
                <span>{t("popularityBoost")}</span>
                <strong>{product.popularityBoost > 0 ? `+${product.popularityBoost}` : "-"}</strong>
              </div>
              <div>
                <span>{t("stock")}</span>
                <strong>{formatProductStock(product)}</strong>
              </div>
            </div>
            {product.quote ? <blockquote>{product.quote}</blockquote> : null}
            {product.components.length > 0 ? (
              <div className="product-component-summary">
                <p className="admin-kicker">{t("keyComponents")}</p>
                <div>
                  {product.components.map((component) => (
                    <span key={component.id}>{component.name}</span>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="product-card-actions">
              <button className="secondary-button compact-button" onClick={onEdit} type="button">
                {t("editProduct")}
              </button>
              <button
                className="secondary-button compact-button danger-action"
                onClick={() => {
                  if (window.confirm(t("removeProductConfirm"))) {
                    void onDelete();
                  }
                }}
                type="button"
              >
                {t("delete")}
              </button>
            </div>
          </section>

          <section className="product-inventory-panel">
            <p className="admin-kicker">{t("quickStockAction")}</p>
            <QuickProductMovementForm product={product} runAction={runAction} />
          </section>
        </div>

        <section className="product-inventory-panel">
          <div className="product-history-header">
            <div>
              <p className="admin-kicker">{t("localMovementHistory")}</p>
              <strong>{productMovements.length} {t("movements")}</strong>
            </div>
            <small>{t("latestProductChanges")}</small>
          </div>
          <DataTable
            columns={[t("date"), t("type"), t("amount"), t("reason")]}
            rows={
              latestMovements.length > 0
                ? latestMovements.map((movement) => [formatStockMovementDateTime(movement.createdAt), movement.type, movement.amount, movement.reason || "-"])
                : [[t("noMovementsForProduct"), "-", "-", "-"]]
            }
          />
        </section>
      </div>
    </AdminModal>
  );
}

function QuickProductMovementForm({
  product,
  runAction
}: {
  product: AdminData["products"][number];
  runAction: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const t = useCrmT();
  const [action, setAction] = useState<"restock" | "write_off" | "correct">("restock");
  const [amountMode, setAmountMode] = useState<StockMovementInput["amountMode"]>(product.contentAmount ? "content" : "packages");
  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const canUseContent = Boolean(product.contentAmount && product.contentUnit);

  useEffect(() => {
    setAmountMode(product.contentAmount ? "content" : "packages");
    setAmount("1");
    setReason("");
  }, [product.id, product.contentAmount]);

  useEffect(() => {
    if (amountMode === "content" && !canUseContent) {
      setAmountMode("packages");
    }
  }, [amountMode, canUseContent]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const rawAmount = Math.abs(Number(amount));
    const signedAmount = action === "write_off" ? -rawAmount : action === "correct" ? Number(amount) : rawAmount;

    void runAction(async () => {
      await createAdminStockMovement({
        productId: product.id,
        movementType: action === "restock" ? "purchase" : "adjustment",
        amountMode,
        amount: signedAmount,
        reason: reason || defaultStockReason(action, t)
      });
      setAmount("1");
      setReason("");
    });
  }

  return (
    <form className="quick-stock-form" onSubmit={submit}>
      <div className="segmented-control" role="group" aria-label={t("stockAction")}>
        <button className={action === "restock" ? "active" : ""} onClick={() => setAction("restock")} type="button">
          {t("stockReplenishment")}
        </button>
        <button className={action === "write_off" ? "active" : ""} onClick={() => setAction("write_off")} type="button">
          {t("manualWriteOff")}
        </button>
        <button className={action === "correct" ? "active" : ""} onClick={() => setAction("correct")} type="button">
          {t("stockCorrection")}
        </button>
      </div>
      <div className="quick-stock-grid">
        <label>
          <span>{t("amountMode")}</span>
          <select value={amountMode} onChange={(event) => setAmountMode(event.target.value as StockMovementInput["amountMode"])}>
            <option value="packages">{t("packages")}</option>
            <option value="content" disabled={!canUseContent}>
              {product.contentUnit ? formatUnit(product.contentUnit) : "ml/g"}
            </option>
          </select>
        </label>
        <label>
          <span>{amountMode === "content" ? `${t("amount")}, ${formatUnit(product.contentUnit)}` : t("packages")}</span>
          <input
            step={amountMode === "content" ? "0.01" : "1"}
            type="number"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </label>
      </div>
      <label>
        <span>{t("reason")}</span>
        <textarea placeholder={defaultStockReason(action, t)} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      {action === "correct" ? <small className="form-note">{t("stockCorrectionHint")}</small> : null}
      {!canUseContent ? <small className="form-note">{t("packageMovementsOnlyHint")}</small> : null}
      <button className="primary-button admin-submit" disabled={!Number(amount)} type="submit">
        {t("save")}
      </button>
    </form>
  );
}

function buildStockMovementHistoryRows(products: AdminData["products"]): StockMovementHistoryRow[] {
  return products
    .flatMap((product) =>
      product.movements.map((movement, index) => ({
        id: `${product.id}-${movement.createdAt}-${movement.type}-${index}`,
        amount: formatStockMovementAmount(movement),
        brand: product.brand,
        category: product.category,
        createdAt: movement.createdAt,
        product: product.name,
        reason: movement.reason,
        type: movement.type
      }))
    )
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

function buildInventorySummary(products: AdminData["products"]) {
  return products.reduce(
    (summary, product) => {
      const stockLevel = getProductStockLevel(product);
      const packageEquivalent = product.stockPackageEquivalent ?? product.stock;

      summary.totalProducts += 1;
      summary.retailValue += product.sale * packageEquivalent;

      if (product.stockStatus !== "not_tracked") {
        summary.trackedProducts += 1;
      }

      if (stockLevel === "low") {
        summary.lowStockProducts += 1;
      }

      if (stockLevel === "out") {
        summary.outOfStockProducts += 1;
      }

      if (product.purpose === "procedure" || product.purpose === "both") {
        summary.procedureProducts += 1;
      }

      return summary;
    },
    {
      lowStockProducts: 0,
      outOfStockProducts: 0,
      procedureProducts: 0,
      retailValue: 0,
      totalProducts: 0,
      trackedProducts: 0
    }
  );
}

function formatProductPurpose(purpose: ProductPurpose | undefined, t: ReturnType<typeof useCrmT>) {
  if (purpose === "sale") {
    return t("forSale");
  }

  if (purpose === "procedure") {
    return t("forProcedures");
  }

  return t("both");
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

function getProductStockLevel(product: AdminData["products"][number]) {
  if (product.stockStatus === "not_tracked") {
    return "not_tracked";
  }

  if (product.stockContentAmount !== null) {
    return product.stockContentAmount <= 0 ? "out" : product.stockStatus;
  }

  return product.stock <= 0 ? "out" : product.stockStatus;
}

function formatProductMargin(product: AdminData["products"][number]) {
  return adminMoney.format(product.sale - product.purchase);
}

function defaultStockReason(action: "restock" | "write_off" | "correct", t: ReturnType<typeof useCrmT>) {
  if (action === "write_off") {
    return t("manualWriteOff");
  }

  if (action === "correct") {
    return t("stockCorrection");
  }

  return t("stockReplenishment");
}

function formatStockMovementAmount(movement: AdminData["products"][number]["movements"][number]) {
  if (movement.contentQuantity !== null && movement.contentUnit) {
    const sign = movement.contentQuantity > 0 ? "+" : "";
    return `${sign}${formatPlainNumber(movement.contentQuantity)} ${formatUnit(movement.contentUnit)}`;
  }

  const sign = movement.quantity > 0 ? "+" : "";
  return `${sign}${movement.quantity} packs`;
}

function formatStockMovementDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function formatStockMovementTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatStockMovementDateTime(value: string) {
  return `${formatStockMovementDate(value)}, ${formatStockMovementTime(value)}`;
}

function toDateTimeFields(value: string) {
  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

  return {
    date: localDate,
    time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  };
}
