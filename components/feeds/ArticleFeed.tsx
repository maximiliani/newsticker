import { NewsPreview } from "@/components/news-preview";
import { Button } from "../ui/button";
import { PlusIcon } from "@radix-ui/react-icons";
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Define the NewsPreviewData type
type NewsPreviewData = {
  id: string;
  metadata: {
    title: string; // Ensure title is a required string
    createdAt: Date;
    modifiedAt: Date;
    author: {
      name: string;
      avatar: string;
    };
    visibility: {
      from: Date;
      to: Date;
    };
  };
  content: string; // Include content if needed
};

const mockNews: NewsPreviewData[] = [
  {
    id: "1",
    metadata: {
      title: "Breakthrough in Quantum Computing: Scientists Achieve New Milestone",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      modifiedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      author: {
        name: "Dr. James Wilson",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
      },
      visibility: {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    content: "Full article text goes here...",
  },
  {
    id: "2",
    metadata: {
      title: "New AI Model Breaks Language Barrier: Unleashing Multilingual Communication",
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      modifiedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      author: {
        name: "Dr. Sarah Chen",
        avatar: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df",
      },
      visibility: {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    content: "Full article text goes here...",
  },
  {
    id: "3",
    metadata: {
      title: "New AI Model Breaks Language Barrier: Unleashing Multilingual Communication",
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      modifiedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      author: {
        name: "Dr. Sarah Chen",
        avatar: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df",
      },
      visibility: {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    content: "Full article text goes here...",
  },
  {
    id: "4",
    metadata: {
      title: "New AI Model Breaks Language Barrier: Unleashing Multilingual Communication",
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      modifiedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      author: {
        name: "Dr. Sarah Chen",
        avatar: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df",
      },
      visibility: {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    content: "Full article text goes here...",
  },
  {
    id: "5",
    metadata: {
      title: "Test",
      createdAt: new Date(Date.now() - 203 * 60 * 60 * 1000),
      modifiedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      author: {
        name: "Test Author",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
      },
      visibility: {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  {
    id: "6",
    metadata: {
      title: "Test",
      createdAt: new Date(Date.now() - 203 * 60 * 60 * 1000),
      modifiedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      author: {
        name: "Test Author 2",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
      },
      visibility: {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  {
    id: "7",
    metadata: {
      title: "Test",
      createdAt: new Date(Date.now() - 203 * 60 * 60 * 1000),
      modifiedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      author: {
        name: "Test Author 2",
        avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
      },
      visibility: {
        from: new Date(Date.now() - 24 * 60 * 60 * 1000),
        to: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    },
    content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  },
  {
    id: "8",
    metadata: {
    title: "Test",
    createdAt: new Date(Date.now() - 203 * 60 * 60 * 1000),
    modifiedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    author: {
      name: "Test Author",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e",
    },
    visibility: {
      from: new Date(Date.now() - 24 * 60 * 60 * 1000),
      to: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    },
  content: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  }
  // ... add more mock news as needed
];

export function ArticleFeed() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Latest News</h2>
        <Button size="sm" className="flex items-center gap-2" variant="outline">
          <PlusIcon className="h-4 w-4" />
          Create news article
        </Button>
      </div>
      <div className="my-4">
        {mockNews.map((news) => (
          <NewsPreview key={news.id} news={news.metadata} />
        ))}
      </div>
    </div>
  );
}

export function ArticleCreation() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await createClient()
      .from('articles') // Assuming you have an 'articles' table
      .insert([
        {
          title,
          content,
          author: { name: authorName },
          createdAt: new Date(),
          modifiedAt: new Date(),
        },
      ]);

    if (error) {
      console.error('Error creating article:', error);
    } else {
      console.log('Article created:', data);
      // Optionally redirect or reset form
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        placeholder="Content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Author Name"
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        required
      />
      <button type="submit">Create Article</button>
    </form>
  );
}