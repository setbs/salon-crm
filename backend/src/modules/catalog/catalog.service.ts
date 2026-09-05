import {
  findPublicProductById,
  insertStoreOrder,
  insertStoreReview,
  listActiveEmployees,
  listActiveServices,
  listPopularPublicProducts,
  listPublicProductComponents,
  listPublicProducts,
  listPublishedStoreReviews,
  listVisiblePortfolio,
  StoreOrderIssue,
  type PublicProductComponentRow,
  type PublicProductRow
} from "./catalog.repository.js";
import { HttpError } from "../../utils/http-error.js";
import { createOrderAccess, requireOrderAccess } from "./order-access.js";
import { createMonobankPaymentForOrder, getPublicStorePaymentStatus } from "../payments/monobank.service.js";
import type { storeOrderSchema, storeReviewSchema } from "./catalog.schemas.js";
import type { z } from "zod";

export async function getServices() {
  const services = await listActiveServices();

  return services.map((service) => ({
    id: service.id.toString(),
    categoryId: service.categoryId?.toString() ?? null,
    category: service.categoryId
      ? {
          id: service.categoryId.toString(),
          name: service.categoryName ?? "Other services",
          description: service.categoryDescription
        }
      : null,
    name: service.name,
    description: service.description,
    durationMinutes: service.durationMinutes,
    price: Number(service.price),
    priceFrom: service.priceFrom ? Number(service.priceFrom) : null,
    priceTo: service.priceTo ? Number(service.priceTo) : null
  }));
}

export async function getEmployees(serviceIds: bigint[]) {
  const employees = await listActiveEmployees(serviceIds);

  return employees.map((employee) => ({
    id: employee.id.toString(),
    firstName: employee.user.firstName,
    lastName: employee.user.lastName,
    specialization: employee.specialization,
    description: employee.description,
    services: employee.services.map(({ service }) => ({
      id: service.id.toString(),
      name: service.name,
      categoryId: null,
      category: null
    }))
  }));
}

export async function getPortfolio() {
  const photos = await listVisiblePortfolio();

  return photos.map((photo) => ({
    id: photo.id.toString(),
    title: photo.description ?? "Salon work",
    description: photo.description,
    imageUrl: photo.imageUrl,
    employee: `${photo.employee.user.firstName} ${photo.employee.user.lastName}`
  }));
}

export async function getProducts() {
  const products = await listPublicProducts();
  const componentsByProduct = await getComponentsByProduct(products);

  return products.map((product) => formatPublicProduct(product, getPublicProductBadge(product), componentsByProduct.get(product.id.toString()) ?? []));
}

export async function getPopularProducts() {
  const products = await listPopularPublicProducts();
  const componentsByProduct = await getComponentsByProduct(products);

  return products.map((product, index) => {
    const soldQuantity = Math.max(Number(product.soldLast30Days ?? 0), Number(product.soldLast90Days ?? 0));
    const badge = index < 3 && soldQuantity > 0 ? "top" : getPublicProductBadge(product);

    return formatPublicProduct(product, badge, componentsByProduct.get(product.id.toString()) ?? []);
  });
}

export async function getStoreReviews() {
  return (await listPublishedStoreReviews()).map(formatStoreReview);
}

export async function createStoreReview(input: z.infer<typeof storeReviewSchema>) {
  return formatStoreReview(await insertStoreReview({ authorName: input.authorName, rating: input.rating, comment: input.comment }));
}

export async function createStoreOrder(input: z.infer<typeof storeOrderSchema>) {
  try {
    const { accessToken, accessTokenHash } = createOrderAccess();
    const order = await insertStoreOrder(input, accessTokenHash);
    return { ...await createMonobankPaymentForOrder(order.id), accessToken };
  } catch (error) {
    if (error instanceof StoreOrderIssue) {
      if (error.code === "INSUFFICIENT_STOCK") throw new HttpError(409, `${error.productName ?? "Product"} is not available in the requested quantity.`);
      throw new HttpError(409, "One or more products are no longer available.");
    }
    throw error;
  }
}

export async function getStoreOrderPaymentStatus(idValue: string, accessToken?: string) {
  return getPublicStorePaymentStatus(await requireOrderAccess(idValue, accessToken));
}

export async function payStoreOrder(idValue: string, accessToken?: string) {
  return createMonobankPaymentForOrder(await requireOrderAccess(idValue, accessToken));
}

export async function getProduct(idValue: string) {
  if (!/^\d+$/.test(idValue)) {
    throw new HttpError(400, "Invalid product id.");
  }

  const product = await findPublicProductById(BigInt(idValue));

  if (!product) {
    throw new HttpError(404, "Product not found.");
  }

  const componentsByProduct = await getComponentsByProduct([product]);

  return formatPublicProduct(product, getPublicProductBadge(product), componentsByProduct.get(product.id.toString()) ?? []);
}

async function getComponentsByProduct(products: PublicProductRow[]) {
  const rows = await listPublicProductComponents(products.map((product) => product.id));
  const componentsByProduct = new Map<string, Array<{ id: string; name: string; description: string | null }>>();

  rows.forEach((row) => {
    const productId = row.productId.toString();
    const currentRows = componentsByProduct.get(productId) ?? [];
    currentRows.push(formatPublicProductComponent(row));
    componentsByProduct.set(productId, currentRows);
  });

  return componentsByProduct;
}

function formatPublicProduct(product: PublicProductRow, badge: "top" | "new" | null = null, components: Array<{ id: string; name: string; description: string | null }> = []) {
  return {
    id: product.id.toString(),
    category: product.categoryId
      ? {
          id: product.categoryId.toString(),
          name: product.categoryName ?? "Home care",
          description: product.categoryDescription,
          imageUrl: product.categoryImageUrl
        }
      : null,
    name: product.name,
    brand: product.brandName ?? product.brand,
    description: product.description,
    quote: product.quote,
    imageUrl: product.imageUrl,
    purpose: product.purpose === "SALE" ? "sale" : product.purpose === "PROCEDURE" ? "procedure" : "both",
    price: Number(product.price),
    contentAmount: product.contentAmount ? Number(product.contentAmount) : null,
    contentUnit: product.contentUnit,
    stockQuantity: product.stockQuantity,
    inStock: product.stockQuantity > 0,
    components,
    createdAt: product.createdAt.toISOString(),
    badge,
    popularityScore: product.popularityScore ? Number(product.popularityScore) : null
  };
}

function formatPublicProductComponent(component: PublicProductComponentRow) {
  return {
    id: component.componentId.toString(),
    name: component.componentName,
    description: component.componentDescription
  };
}

function formatStoreReview(review: { id: bigint; authorName: string; rating: number; comment: string; createdAt: Date }) {
  return { id: review.id.toString(), authorName: review.authorName, rating: review.rating, comment: review.comment, createdAt: review.createdAt.toISOString() };
}

function getPublicProductBadge(product: PublicProductRow): "new" | null {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  return product.createdAt >= twoWeeksAgo ? "new" : null;
}
