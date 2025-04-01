"use server";

import { revalidatePath } from "next/cache";
import User from "../Models/user.model";
import { connectToDB } from "../mongoose";
import Thread from "../Models/thread.model";
import { FilterQuery, SortOrder } from "mongoose";
import { connect } from "http2";

export async function fetchUser(userId: string) {
  try {
    connectToDB();
    return await User.findOne({ id: userId });
    // .populate({
    //   path: 'communities',
    //   model: 'Community',
    // })
  } catch (err: any) {
    throw new Error(`Faild to fetch user: ${err?.message}`);
  }
}

interface Params {
  userId: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  path: string;
}

export async function UpdateUser({
  userId,
  bio,
  name,
  path,
  username,
  image,
}: Params): Promise<void> {
  // TODO: Implement update logic for user data
  // This function should update user data in the database

  try {
    connectToDB();
    await User.findOneAndUpdate(
      { id: userId },

      {
        username: username.toLowerCase(),
        name,
        bio,
        image,
        onboarded: true,
      },
      { upsert: true }
    );

    if (path == "/profile/edit") {
      revalidatePath(path);
    }
  } catch (error: any) {
    throw new Error(`Error updating user data: ${error?.message}`);
  }
}

export async function fetchUserPosts(userId: string) {
  try {
    connectToDB();
    // Todo: populate community
    const threads = await User.findOne({ id: userId }).populate({
      path: "threads",
      model: Thread,
      populate: {
        path: "children",
        model: Thread,
        populate: {
          path: "author",
          model: User,
          select: "_id id name image",
        },
      },
    });

    return threads;
  } catch (error: any) {
    throw new Error(`Failed to fetch user posts: ${error?.message}`);
  }
}

export async function fetchUsers({
  userId,
  searchString = "",
  pageNumber = 1,
  pageSize = 20,
  sortBy = "desc",
}: {
  userId: string;
  searchString?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: SortOrder;
}) {
  try {
    connectToDB();

    const skipAmount = (pageNumber - 1) * pageSize;

    const regex = new RegExp(searchString, "i");

    const query: FilterQuery<typeof User> = {
      id: { $ne: userId },
    };

    if (searchString.trim() !== "") {
      query.$or = [
        {
          username: { $regex: regex },
        },
        {
          name: { $regex: regex },
        },
      ];
    }

    const sortOptions = { createdAt: sortBy };

    const usersQuery = User.find(query)
      .sort(sortOptions)
      .skip(skipAmount)
      .limit(pageSize);

    const totalUserCount = await User.countDocuments(query);

    const users = await usersQuery.exec();
    const isNext = totalUserCount > skipAmount + users.length;

    return { users, isNext };
  } catch (err: any) {
    throw new Error(`Failed to connect to database: ${err.message}`);
  }
}



export async function getActivity (userId:string){

  try{
      connectToDB();

      //find all threads created by user
      const userThreads = await Thread.find({author:userId})

      // collect all the child ids (replies) from "children"
    const childThreadsIds = userThreads.reduce((acc , userThread)=>{
      return acc.concat(userThread.children)
    },[])

    const replies = await Thread.find({
      _id: {$in: childThreadsIds},
      author:{$ne:userId}
    }).populate({
      path:'author',
      model:User,
      select: '_id id name image'
    })


    return replies

  }catch (err:any) {
    throw new Error(`Failed to connect to database: ${err.message}`)
  }
}