interface PageHeadingProps {
  heading: string;
  text?: string;
}

export function PageHeading({ heading, text }: PageHeadingProps) {
  return (
    <div className="flex flex-col items-start gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}
