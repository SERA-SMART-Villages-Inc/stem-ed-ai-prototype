import type { StudentDataAdapter } from "@/lib/services/StudentDataAdapter";
import { MockOneRosterAdapter } from "./MockOneRosterAdapter";
import { MockEdFiAdapter } from "./MockEdFiAdapter";

export type MockDataSource = "oneroster" | "edfi";

export const DEFAULT_DATA_SOURCE: MockDataSource = "oneroster";

/** Both adapters describe the same synthetic district — swap freely. */
export function getAdapter(source: MockDataSource = DEFAULT_DATA_SOURCE): StudentDataAdapter {
  switch (source) {
    case "edfi":
      return new MockEdFiAdapter();
    case "oneroster":
    default:
      return new MockOneRosterAdapter();
  }
}

export { MockOneRosterAdapter, MockEdFiAdapter };
