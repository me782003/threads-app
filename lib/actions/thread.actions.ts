"use server";
import { revalidatePath } from "next/cache";
import Thread from "../Models/thread.model";
import User from "../Models/user.model";
import { connectToDB } from "../mongoose";

interface Params {
  text: string;
  author: string;
  communityId: string | null;
  path: string;
}

export async function CreateThread({
  text,
  author,
  communityId,
  path,
}: Params) {
  try {
    connectToDB();

    const createdThread = await Thread.create({
      text,
      author,
      community: null,
    });

    // TODO: Update user model
    await User.findByIdAndUpdate(author, {
      $push: { threads: createdThread._id },
    });
    revalidatePath(path);
  } catch (err: any) {
    throw new Error(`Error creating thread: ${err.message}`);
  }
}

export async function fetchPosts(pageNumber = 1, pageSize = 20) {
  connectToDB();

  // Calculate number of posts to skip

  const skipAmout = (pageNumber - 1) * pageSize;

  const postsQuery = Thread.find({
    parentId: {
      $in: [null, undefined],
    },
  })
    .sort({ createdAt: "desc" })
    .skip(skipAmout)
    .limit(pageSize)
    .populate({
      path: "author",
      model: User,
    })
    .populate({
      path: "children",
      populate: {
        path: "author",
        model: User,
        select: "_id name parent_id image",
      },
    });

  const totalPostsCount = await Thread.countDocuments({
    parentId: {
      $in: [null, undefined],
    },
  });

  const posts = await postsQuery.exec();
  const isNext = totalPostsCount > skipAmout;

  return {
    posts,
    isNext,
  };
}


export async function fetchThreadById(id: string){
   //connect to db
   connectToDB();

   try{
    // TODO: POPULATE COMMUNITY
    const thread = await Thread.findById(id).populate({
      path:"author",
      model:User,
      select: "_id id name image"
    })
    .populate({
      path: "children", // Populate the children field
      populate: [
        {
          path: "author", // Populate the author field within children
          model: User,
          select: "_id id name parentId image", // Select only _id and username fields of the author
        },
        {
          path: "children", // Populate the children field within children
          model: Thread, // The model of the nested children (assuming it's the same "Thread" model)
          populate: {
            path: "author", // Populate the author field within nested children
            model: User,
            select: "_id id name parentId image", // Select only _id and username fields of the author
          },
        },
      ],
    }).exec()
    return thread;

   }catch (error: any) {
    throw new Error(`Failed to fetch thread by id: ${error?.message}`);
   }

}

export async function addCommentToThread(threadId:string , commentText:string , userId:string , path:string){
  //connect to db
  connectToDB();
  try{


    // Find the original thread by its id
    const originalthread = await Thread.findById(threadId)

    if(!originalthread) throw new Error(`Could not find thread`);

    // Create a new comment object with the provided text and the author's id

    const commentThread = new Thread({
      text: commentText,
      author: userId,
      parentId: threadId,
    })

    //save the new thread 
    const savedCommentThread = await commentThread.save();

    //update original thread to include the new comment
    originalthread.children.push(savedCommentThread._id);
    await originalthread.save();

    revalidatePath(path);


  }catch (error:any) {
    throw new Error(`Failed to add comment to thread: ${error?.message}`);
  }
}
