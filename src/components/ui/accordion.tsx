import * as React from 'react';
import { Accordion as RadixAccordion } from 'radix-ui';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function Accordion({ ...props }: React.ComponentProps<typeof RadixAccordion.Root>) {
  return <RadixAccordion.Root data-slot="accordion" {...props} />;
}

function AccordionItem({ className, ...props }: React.ComponentProps<typeof RadixAccordion.Item>) {
  return (
    <RadixAccordion.Item
      data-slot="accordion-item"
      className={cn('border-b border-border/60 last:border-b-0', className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadixAccordion.Trigger>) {
  return (
    <RadixAccordion.Header className="flex">
      <RadixAccordion.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'flex flex-1 items-center justify-between py-4 text-left text-sm font-semibold transition-all hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&[data-state=open]>svg]:rotate-180 cursor-pointer',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
      </RadixAccordion.Trigger>
    </RadixAccordion.Header>
  );
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadixAccordion.Content>) {
  return (
    <RadixAccordion.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn('pb-4 pt-0 text-muted-foreground leading-relaxed', className)}>
        {children}
      </div>
    </RadixAccordion.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
