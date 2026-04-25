import { toast } from "sonner"

export function toastSuccess(message: string, description?: string): void {
  toast.success(message, description ? { description } : undefined)
}

export function toastError(message: string, description?: string): void {
  toast.error(message, description ? { description } : undefined)
}

export function toastInfo(message: string, description?: string): void {
  toast.info(message, description ? { description } : undefined)
}

export function toastAction(
  message: string,
  actionLabel: string,
  onAction: () => void,
  description?: string,
): void {
  toast(message, {
    description,
    action: { label: actionLabel, onClick: onAction },
  })
}
