import Construction from '@components/construction';
import { Image } from '@heroui/react';

export default function Home() {
  return (
    <main>
      <div className="flex items-center justify-center h-screen">
        <Construction
          cta={{
            text: "Get notified when we launch!",
            icon: (
              <Image src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Travel%20and%20places/Rocket.png" alt="Rocket" width="25" height="25" />
            ),
          }}
        />
      </div>
    </main>
  );
}
