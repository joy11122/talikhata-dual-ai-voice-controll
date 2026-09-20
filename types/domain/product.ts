export interface Product {
  _id: string;
  name: string;
  unit: string;
  stockQuantity: number;
  buyPrice: number;
  sellPrice: number;
  lowStockThreshold: number;
}
