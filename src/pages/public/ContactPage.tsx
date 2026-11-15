import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Phone, Clock, Send, MessageSquare, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldFeedback } from '@/components/ui/field-feedback';
import { Badge } from '@/components/ui/badge';
import { contactApi } from '@/api/contact.api';

const contactFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name cannot exceed 50 characters'),
  email: z.string().email('Please enter a valid email address'),
  subject: z
    .string()
    .min(4, 'Subject must be at least 4 characters')
    .max(100, 'Subject cannot exceed 100 characters'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(1000, 'Message cannot exceed 1000 characters'),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export const ContactPage: React.FC = () => {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: '',
      message: '',
    },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setIsSubmitting(true);
    try {
      await contactApi.sendMessage(data);
      setSubmittedEmail(data.email);
      setIsSubmitted(true);
      toast.success('Inquiry submitted successfully!', {
        description: `Message delivered from ${data.email} to parkease@gmail.com in Mailpit.`,
      });
      reset();
    } catch (err: unknown) {
      const apiErrorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Unable to send your message. Please try again.');
      toast.error('Failed to send message', {
        description: apiErrorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-12 sm:space-y-16">
      {/* 1. HEADER */}
      <div className="max-w-3xl space-y-3">
        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
          Get in Touch
        </Badge>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          How can we help?
        </h1>
        <p className="text-base text-muted-foreground sm:text-lg leading-relaxed">
          Have a question about parking, bookings, your account, or becoming a parking partner? Get
          in touch with the ParkEase team.
        </p>
      </div>

      {/* 2. TWO COLUMN LAYOUT */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* Left Column: Contact Cards (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Official Contact Details</CardTitle>
              <CardDescription className="text-xs">
                Direct channels for general support, partnerships, and account inquiries.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-2">
              {/* Phone */}
              <div className="flex items-start gap-3.5">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Phone Support
                  </h2>
                  <a
                    href="tel:+919099077378"
                    className="text-sm font-semibold text-primary hover:underline transition-all block mt-0.5"
                  >
                    +91 9099077378
                  </a>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Available for customer assistance &amp; gate inquiries.
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start gap-3.5">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Email Inquiries
                  </h2>
                  <a
                    href="mailto:parkease@gmail.com"
                    className="text-sm font-semibold text-primary hover:underline transition-all block mt-0.5"
                  >
                    parkease@gmail.com
                  </a>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Responses typically delivered within 24 hours.
                  </p>
                </div>
              </div>

              {/* Operating Hours */}
              <div className="flex items-start gap-3.5">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary shrink-0">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Platform Availability
                  </h2>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    24/7 Digital Reservations
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Live booking and QR gate scanning operate continuously.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Contact Form (7 cols) */}
        <div className="lg:col-span-7">
          <Card className="border-border/80 bg-card">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">Send Us a Message</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Fill out the form below and our team will get back to you promptly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isSubmitted ? (
                <div className="py-8 text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Message Sent to parkease@gmail.com</h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    We have received your inquiry sent from <strong className="text-foreground">{submittedEmail || 'your email'}</strong>. Our support team will review your message in Mailpit and reach out shortly.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setIsSubmitted(false)}>
                    Send Another Message
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-name">Full Name</Label>
                    <Input
                      id="contact-name"
                      placeholder="Your full name"
                      disabled={isSubmitting}
                      {...register('name')}
                    />
                    {errors.name && <FieldFeedback status="error" message={errors.name.message} />}
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email">Email Address</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="name@example.com"
                      disabled={isSubmitting}
                      {...register('email')}
                    />
                    {errors.email && (
                      <FieldFeedback
                        status="error"
                        message={errors.email.message}
                        suggestion="Format: name@example.com"
                      />
                    )}
                  </div>

                  {/* Subject */}
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-subject">Subject</Label>
                    <Input
                      id="contact-subject"
                      placeholder="Booking inquiry, partner application, or general feedback"
                      disabled={isSubmitting}
                      {...register('subject')}
                    />
                    {errors.subject && (
                      <FieldFeedback status="error" message={errors.subject.message} />
                    )}
                  </div>

                  {/* Message */}
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-message">Message</Label>
                    <Textarea
                      id="contact-message"
                      rows={4}
                      placeholder="Describe your question or issue in detail..."
                      disabled={isSubmitting}
                      {...register('message')}
                    />
                    {errors.message && (
                      <FieldFeedback status="error" message={errors.message.message} />
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full gap-2 font-semibold shadow-xs"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full" />
                        Submitting...
                      </span>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
