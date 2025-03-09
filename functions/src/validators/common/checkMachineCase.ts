import { DocumentSnapshot } from "firebase-admin/firestore"

export function checkMachineCase(messageSnap: DocumentSnapshot) {
  const isMachineCategorised = messageSnap.get("isMachineCategorised") ?? false
  const isWronglyCategorisedIrrelevant =
    messageSnap.get("isWronglyCategorisedIrrelevant") ?? false
  const machineCategory = messageSnap.get("machineCategory")
  const isMachineCase =
    isMachineCategorised &&
    machineCategory &&
    !(machineCategory === "irrelevant" && isWronglyCategorisedIrrelevant)
  return isMachineCase
}
