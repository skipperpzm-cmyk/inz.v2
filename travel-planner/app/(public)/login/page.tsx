import LoginForm from '@/components/auth/LoginForm';

export default function Page() {
  return (
    <div className="flex-1 flex flex-col w-full">
      <main className="flex-1 flex items-start justify-center pt-16 sm:pt-20 md:pt-24 lg:pt-28">
        <LoginForm />
      </main>
    </div>
  );
}
