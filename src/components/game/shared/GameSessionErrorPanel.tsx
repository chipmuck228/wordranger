import { Button } from "@/components/ui/button";

export function GameSessionErrorPanel(props: {
  message: string;
  onRetry?: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-6 text-center">
      <p className="text-base" role="alert">
        {props.message}
      </p>
      {props.onRetry ? (
        <Button
          type="button"
          className="h-12 w-full text-base"
          onClick={props.onRetry}
        >
          再试一次
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-12 w-full text-base"
        onClick={props.onBack}
      >
        返回
      </Button>
    </div>
  );
}
