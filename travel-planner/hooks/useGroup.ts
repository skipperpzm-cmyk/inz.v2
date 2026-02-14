import { useGroupContext } from "../contexts/GroupContext";

export function useGroup() {
  return useGroupContext();
}
